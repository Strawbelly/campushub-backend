// E2E acceptance tests for e2e/scenarios/reservation.feature.
//
// Runs against the real client (Vite, :5173) and API (:3000) started by
// playwright.config.ts — no requests are mocked. The API has no endpoint for
// creating resources, so the test resource is looked up (or inserted if
// missing) directly in MongoDB (MONGODB_URI from .env, loaded by
// playwright.config.ts). Existing data is never modified. Reservations are
// created through the UI or the public API and cancelled through the API
// afterwards, which frees their time slot.
//
// Run with --workers=1: all browsers use the same fixed slots tomorrow.

import { test, expect } from '@playwright/test';
import type { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import mongoose from 'mongoose';
import { Resource } from '../src/models/Resource.model';
import type { IResourceDocument } from '../src/models/Resource.model';
import { Reservation } from '../src/models/Reservation.model';
import type { IReservation, ReservationStatus } from '../src/types/reservation';

const API_URL: string = 'http://localhost:3000/api/v1';
const RESOURCE_NAME: string = 'Snell Library Room 101';
const RESOURCE_LOCATION: string = 'Snell Library';
// Bookings that "already exist" belong to someone other than the UI's student.
const OTHER_STUDENT_ID: string = 'e2e-other-student';
const ACTIVE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

const SUCCESS_MESSAGE: string = 'Booking request submitted (status: PENDING).';
const CONFLICT_MESSAGE: string = 'That time slot is already reserved. Please choose another time.';

let resourceId: string = '';
let createdReservationIds: string[] = [];

const isReservationBody = (value: unknown): value is IReservation =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === 'string' &&
  typeof (value as Record<string, unknown>).status === 'string';

const pad = (value: number): string => String(value).padStart(2, '0');

// Value for an <input type="datetime-local">, in the browser's local time.
const toDateTimeLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
  `T${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Tomorrow at hh:mm in local time — the browser uses the same timezone.
const tomorrowAt = (hours: number, minutes: number): Date => {
  const now: Date = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
};

// Read-only precondition check. Active reservations that this run did not
// create are never cancelled or changed, so the test fails instead.
const assertSlotFree = async (start: Date, end: Date): Promise<void> => {
  const overlapping: { _id: unknown } | null = await Reservation.exists({
    resourceId,
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lt: end },
    endTime: { $gt: start },
  });
  expect(
    overlapping,
    `${RESOURCE_NAME} already has an active reservation between ${start.toString()} and ` +
      `${end.toString()}. The tests will not cancel existing data; free the slot and run again.`,
  ).toBeNull();
};

// Given "<resource>" has an active reservation from <start> to <end>.
const createExistingReservation = async (
  request: APIRequestContext,
  start: Date,
  end: Date,
): Promise<IReservation> => {
  const response = await request.post(`${API_URL}/reservations`, {
    data: {
      resourceId,
      userId: OTHER_STUDENT_ID,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
  });
  expect(response.status(), 'seeding the existing reservation').toBe(201);
  const body: unknown = await response.json();
  if (!isReservationBody(body)) {
    throw new Error('POST /reservations returned an unexpected body.');
  }
  createdReservationIds.push(body.id);
  return body;
};

// Records the reservation id from the UI's POST so it can be cleaned up,
// whether or not the test expected the booking to succeed.
const trackBookingResponse = (page: Page): Promise<Response> =>
  page.waitForResponse(
    (response: Response): boolean =>
      response.url().endsWith('/api/v1/reservations') && response.request().method() === 'POST',
  );

const recordCreatedReservation = async (response: Response): Promise<void> => {
  if (response.status() !== 201) {
    return;
  }
  const body: unknown = await response.json();
  if (isReservationBody(body)) {
    createdReservationIds.push(body.id);
  }
};

// Fixed id used only when the resource has to be created. Resource names are
// not unique in the schema, so two runs inserting by name could each add a
// copy; inserting with a fixed _id cannot, because _id is unique.
const TEST_RESOURCE_ID: mongoose.Types.ObjectId = new mongoose.Types.ObjectId('0000000000000000000e2e01');

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as Record<string, unknown>).code === 11000;

// Uses the existing "Snell Library Room 101" as-is, or inserts it if missing.
// Existing resources are never modified: an unavailable one fails the run.
const ensureTestResource = async (): Promise<string> => {
  const found: IResourceDocument | null = await Resource.findOne({ name: RESOURCE_NAME });
  if (found !== null) {
    if (!found.isAvailable) {
      throw new Error(
        `"${RESOURCE_NAME}" is marked unavailable, so its "Book" button is disabled. ` +
          'The tests will not change existing resources; make it available and run again.',
      );
    }
    return String(found._id);
  }

  try {
    await Resource.create({
      _id: TEST_RESOURCE_ID,
      name: RESOURCE_NAME,
      type: 'ROOM',
      location: RESOURCE_LOCATION,
      isAvailable: true,
    });
  } catch (err: unknown) {
    // Another worker inserted it at the same moment; the document exists.
    if (!isDuplicateKeyError(err)) {
      throw err;
    }
  }
  return TEST_RESOURCE_ID.toHexString();
};

const resourceCard = (page: Page): Locator =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: RESOURCE_NAME, exact: true }) })
    .first();

const requestBooking = async (page: Page, start: Date, end: Date): Promise<Response> => {
  await resourceCard(page).getByRole('button', { name: 'Book', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Book ${RESOURCE_NAME}` })).toBeVisible();

  await page.getByLabel('Start time').fill(toDateTimeLocal(start));
  await page.getByLabel('End time').fill(toDateTimeLocal(end));

  const bookingResponse: Promise<Response> = trackBookingResponse(page);
  await page.getByRole('button', { name: 'Request booking' }).click();
  const response: Response = await bookingResponse;
  await recordCreatedReservation(response);
  return response;
};

test.describe('Feature: Campus resource reservation', () => {
  test.beforeAll(async (): Promise<void> => {
    // Every browser project books the same room for the same slots tomorrow,
    // so no two tests may run at the same time.
    if (test.info().config.workers > 1) {
      throw new Error(
        'These tests share fixed time slots across browsers and cannot run in parallel. ' +
          'Run them with --workers=1.',
      );
    }
    const uri: string | undefined = process.env.MONGODB_URI;
    if (uri === undefined || uri.trim() === '') {
      throw new Error('MONGODB_URI must be set (in .env) to prepare E2E test data.');
    }
    await mongoose.connect(uri);

    // Background: Given the resource "Snell Library Room 101" exists and is available.
    resourceId = await ensureTestResource();
  });

  test.afterAll(async (): Promise<void> => {
    await mongoose.disconnect();
  });

  test.beforeEach(async ({ page }): Promise<void> => {
    createdReservationIds = [];
    // Background: And I am on the CampusHub home page.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'CampusHub', level: 1 })).toBeVisible();
    await expect(resourceCard(page)).toBeVisible();
  });

  test.afterEach(async ({ request }): Promise<void> => {
    for (const id of createdReservationIds) {
      const response = await request.patch(`${API_URL}/reservations/${id}/cancel`);
      expect([200, 409], `cancelling reservation ${id}`).toContain(response.status());
    }
  });

  test('Scenario: Student successfully books an available resource', async ({ page }): Promise<void> => {
    // Given the resource has no active reservations tomorrow between 10:00 and 11:00.
    const start: Date = tomorrowAt(10, 0);
    const end: Date = tomorrowAt(11, 0);
    await assertSlotFree(start, end);

    // When I book it from the start time to the end time.
    const response: Response = await requestBooking(page, start, end);
    expect(response.status()).toBe(201);

    // Then I should see the PENDING confirmation.
    await expect(page.getByRole('status')).toHaveText(SUCCESS_MESSAGE);

    // And "My Bookings" lists the reservation with status PENDING.
    const expectedTime: string = await page.evaluate(
      (iso: string): string =>
        new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
      start.toISOString(),
    );
    const booking: Locator = page
      .getByRole('listitem')
      .filter({ hasText: `${RESOURCE_NAME} · ${RESOURCE_LOCATION}` })
      .filter({ hasText: expectedTime });
    await expect(booking).toHaveCount(1);
    await expect(booking.getByText('PENDING', { exact: true })).toBeVisible();
    await expect(booking.getByRole('button', { name: 'Cancel Reservation' })).toBeVisible();
  });

  test('Scenario: Student is told the time slot is already reserved', async ({
    page,
    request,
  }): Promise<void> => {
    // Given the resource has an active reservation tomorrow from 10:00 to 11:00.
    await assertSlotFree(tomorrowAt(10, 0), tomorrowAt(11, 30));
    const existing: IReservation = await createExistingReservation(
      request,
      tomorrowAt(10, 0),
      tomorrowAt(11, 0),
    );
    expect(ACTIVE_STATUSES).toContain(existing.status);

    // When I request tomorrow from 10:30 to 11:30, which overlaps it.
    const response: Response = await requestBooking(page, tomorrowAt(10, 30), tomorrowAt(11, 30));
    expect(response.status()).toBe(409);

    // Then I should see the conflict message, and no success message.
    await expect(page.getByText(CONFLICT_MESSAGE, { exact: true })).toBeVisible();
    await expect(page.getByText('Booking request submitted')).toHaveCount(0);
  });
});
