/// <reference types="jest" />
import request from 'supertest';
import app from '../../app';
import { Reservation } from '../../models/Reservation.model';
import { createResource } from '../../services/resource.service';
import type { ICreateReservationRequest, IResource } from '../../types/reservation';

// Integration tests against the real Express app and routes. The in-memory
// MongoDB lifecycle (connect, clear between tests, shutdown) is handled by
// src/test/setup.ts, so every test seeds its own data.

const BASE = '/api/v1';
const START: string = '2026-12-01T10:00:00.000Z';
const END: string = '2026-12-01T11:00:00.000Z';

const isResourceArray = (value: unknown): value is IResource[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown): boolean =>
      typeof item === 'object' && item !== null && 'id' in item && 'type' in item,
  );

const responseResources = (body: unknown): IResource[] => {
  if (!isResourceArray(body)) {
    throw new Error('Response body is not an array of resources.');
  }
  return body;
};

const sortedNames = (resources: IResource[]): string[] =>
  resources.map((r: IResource): string => r.name).sort();

describe('POST /api/v1/reservations', (): void => {
  let resourceId: string;

  beforeEach(async (): Promise<void> => {
    const resource: IResource = await createResource({
      name: 'Snell Library Room 101',
      type: 'ROOM',
      location: 'Snell Library',
    });
    resourceId = resource.id;
  });

  const payload = (overrides: Partial<ICreateReservationRequest> = {}): ICreateReservationRequest => ({
    resourceId,
    userId: 'user-1',
    startTime: START,
    endTime: END,
    ...overrides,
  });

  it('returns 201 Created with the new Reservation', async (): Promise<void> => {
    const res: request.Response = await request(app)
      .post(`${BASE}/reservations`)
      .send(payload());

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const body: unknown = res.body;
    expect(body).toEqual({
      id: expect.any(String) as unknown as string,
      resourceId,
      userId: 'user-1',
      startTime: START,
      endTime: END,
      status: 'PENDING',
    });
    expect(await Reservation.countDocuments({ resourceId })).toBe(1);
  });

  it('returns 409 Conflict with an ErrorResponse for an overlapping reservation', async (): Promise<void> => {
    const first: request.Response = await request(app)
      .post(`${BASE}/reservations`)
      .send(payload());
    expect(first.status).toBe(201);

    // Starts inside the first reservation's window.
    const res: request.Response = await request(app)
      .post(`${BASE}/reservations`)
      .send(
        payload({
          userId: 'user-2',
          startTime: '2026-12-01T10:30:00.000Z',
          endTime: '2026-12-01T11:30:00.000Z',
        }),
      );

    expect(res.status).toBe(409);
    const body: unknown = res.body;
    expect(body).toEqual({
      code: 'RESERVATION_CONFLICT',
      message: expect.any(String) as unknown as string,
    });
    expect(await Reservation.countDocuments({ resourceId })).toBe(1);
  });
});

describe('GET /api/v1/resources', (): void => {
  beforeEach(async (): Promise<void> => {
    await createResource({ name: 'Room A', type: 'ROOM', location: 'Snell', isAvailable: true });
    await createResource({ name: 'Room B', type: 'ROOM', location: 'Snell', isAvailable: false });
    await createResource({ name: 'Projector', type: 'EQUIPMENT', location: 'Curry', isAvailable: true });
    await createResource({ name: 'Bio Lab', type: 'LAB', location: 'Mugar', isAvailable: false });
  });

  it('returns 200 OK with all resources when no filters are given', async (): Promise<void> => {
    const res: request.Response = await request(app).get(`${BASE}/resources`);

    expect(res.status).toBe(200);
    expect(sortedNames(responseResources(res.body))).toEqual(
      ['Bio Lab', 'Projector', 'Room A', 'Room B'],
    );
  });

  it('returns 200 OK filtered by type', async (): Promise<void> => {
    const res: request.Response = await request(app)
      .get(`${BASE}/resources`)
      .query({ type: 'ROOM' });

    expect(res.status).toBe(200);
    const resources: IResource[] = responseResources(res.body);
    expect(sortedNames(resources)).toEqual(['Room A', 'Room B']);
    expect(resources.every((r: IResource): boolean => r.type === 'ROOM')).toBe(true);
  });

  it('returns 200 OK filtered by isAvailable', async (): Promise<void> => {
    const res: request.Response = await request(app)
      .get(`${BASE}/resources`)
      .query({ isAvailable: 'false' });

    expect(res.status).toBe(200);
    const resources: IResource[] = responseResources(res.body);
    expect(sortedNames(resources)).toEqual(['Bio Lab', 'Room B']);
    expect(resources.every((r: IResource): boolean => !r.isAvailable)).toBe(true);
  });

  it('returns 200 OK filtered by type and isAvailable together', async (): Promise<void> => {
    const res: request.Response = await request(app)
      .get(`${BASE}/resources`)
      .query({ type: 'ROOM', isAvailable: 'true' });

    expect(res.status).toBe(200);
    const resources: IResource[] = responseResources(res.body);
    expect(resources).toHaveLength(1);
    expect(resources[0]).toEqual({
      id: expect.any(String) as unknown as string,
      name: 'Room A',
      type: 'ROOM',
      location: 'Snell',
      isAvailable: true,
    });
  });

  it('returns 400 with an ErrorResponse for an invalid type filter', async (): Promise<void> => {
    const res: request.Response = await request(app)
      .get(`${BASE}/resources`)
      .query({ type: 'GYM' });

    expect(res.status).toBe(400);
    const body: unknown = res.body;
    expect(body).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String) as unknown as string,
    });
  });
});

describe('reservation lookup and status endpoints', (): void => {
  let reservationId: string;

  beforeEach(async (): Promise<void> => {
    const resource: IResource = await createResource({
      name: 'Snell Library Room 101',
      type: 'ROOM',
      location: 'Snell Library',
    });
    const created: request.Response = await request(app)
      .post(`${BASE}/reservations`)
      .send({ resourceId: resource.id, userId: 'user-1', startTime: START, endTime: END });
    const body: unknown = created.body;
    if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string') {
      throw new Error('Seed reservation was not created.');
    }
    reservationId = body.id;
  });

  it('GET /reservations/user/{userId} returns 200 with that user\'s reservations', async (): Promise<void> => {
    const res: request.Response = await request(app).get(`${BASE}/reservations/user/user-1`);

    expect(res.status).toBe(200);
    const body: unknown = res.body;
    expect(body).toEqual([expect.objectContaining({ id: reservationId, userId: 'user-1' })]);
  });

  it('PATCH /reservations/{id}/confirm returns 200 with status CONFIRMED', async (): Promise<void> => {
    const res: request.Response = await request(app).patch(
      `${BASE}/reservations/${reservationId}/confirm`,
    );

    expect(res.status).toBe(200);
    const body: unknown = res.body;
    expect(body).toEqual(expect.objectContaining({ id: reservationId, status: 'CONFIRMED' }));
  });

  it('PATCH /reservations/{id}/cancel returns 200 with status CANCELLED', async (): Promise<void> => {
    const res: request.Response = await request(app).patch(
      `${BASE}/reservations/${reservationId}/cancel`,
    );

    expect(res.status).toBe(200);
    const body: unknown = res.body;
    expect(body).toEqual(expect.objectContaining({ id: reservationId, status: 'CANCELLED' }));
  });
});
