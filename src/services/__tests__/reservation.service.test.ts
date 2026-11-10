/// <reference types="jest" />
import { Types } from 'mongoose';
import { IResourceDocument, Resource } from '../../models/Resource.model';
import { Reservation } from '../../models/Reservation.model';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listReservationsForUser,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
} from '../reservation.service';
import { createResource, listResources, ResourceValidationError } from '../resource.service';
import type {
  ICreateReservationRequest,
  IReservation,
  IResource,
} from '../../types/reservation';

// The in-memory MongoDB lifecycle (connect, clear between tests, shutdown)
// is handled by src/test/setup.ts.

const BASE_START: Date = new Date('2026-12-01T10:00:00.000Z');
const BASE_END: Date = new Date('2026-12-01T11:00:00.000Z');

const createTestResource = async (): Promise<IResourceDocument> =>
  Resource.create({ name: 'Snell Library Room 101', type: 'ROOM', location: 'Snell Library' });

const buildRequest = (
  resourceId: string,
  startTime: Date,
  endTime: Date,
  userId: string = 'user-1',
): ICreateReservationRequest => ({
  resourceId,
  userId,
  startTime: startTime.toISOString(),
  endTime: endTime.toISOString(),
});

describe('reservation.service', (): void => {
  let resourceId: string;

  beforeEach(async (): Promise<void> => {
    const resource: IResourceDocument = await createTestResource();
    resourceId = String(resource._id);
  });

  describe('happy path', (): void => {
    it('creates and persists a resource via createResource()', async (): Promise<void> => {
      const created: IResource = await createResource({
        name: 'Richards Hall Lab 3',
        type: 'LAB',
        location: 'Richards Hall',
      });

      expect(created).toEqual({
        id: expect.any(String) as unknown as string,
        name: 'Richards Hall Lab 3',
        type: 'LAB',
        location: 'Richards Hall',
        isAvailable: true,
      });
      const stored: IResourceDocument | null = await Resource.findById(created.id);
      expect(stored).not.toBeNull();
      expect(stored?.name).toBe('Richards Hall Lab 3');
      expect(stored?.type).toBe('LAB');
    });

    it('places a valid reservation as PENDING', async (): Promise<void> => {
      const result: IReservation = await createReservation(
        buildRequest(resourceId, BASE_START, BASE_END),
      );

      expect(result).toEqual({
        id: expect.any(String) as unknown as string,
        resourceId,
        userId: 'user-1',
        startTime: BASE_START.toISOString(),
        endTime: BASE_END.toISOString(),
        status: 'PENDING',
      });
      expect(await Reservation.countDocuments({ resourceId })).toBe(1);
    });

    it('cancels an existing reservation', async (): Promise<void> => {
      const created: IReservation = await createReservation(
        buildRequest(resourceId, BASE_START, BASE_END),
      );

      const cancelled: IReservation = await cancelReservation(created.id);

      expect(cancelled.id).toBe(created.id);
      expect(cancelled.status).toBe('CANCELLED');
      const stored = await Reservation.findById(created.id);
      expect(stored?.status).toBe('CANCELLED');
    });

    it('frees the slot once a reservation is cancelled', async (): Promise<void> => {
      const created: IReservation = await createReservation(
        buildRequest(resourceId, BASE_START, BASE_END),
      );
      await cancelReservation(created.id);

      const rebooked: IReservation = await createReservation(
        buildRequest(resourceId, BASE_START, BASE_END, 'user-2'),
      );

      expect(rebooked.status).toBe('PENDING');
    });
  });

  describe('edge cases', (): void => {
    it('rejects double-booking with exactly matching start and end times', async (): Promise<void> => {
      await createReservation(buildRequest(resourceId, BASE_START, BASE_END));

      const attempt: Promise<IReservation> = createReservation(
        buildRequest(resourceId, BASE_START, BASE_END, 'user-2'),
      );

      await expect(attempt).rejects.toBeInstanceOf(ReservationConflictError);
      await expect(attempt).rejects.toMatchObject({ code: 'RESERVATION_CONFLICT' });
      expect(await Reservation.countDocuments({ resourceId })).toBe(1);
    });

    it('rejects a reservation whose endTime is before startTime', async (): Promise<void> => {
      const attempt: Promise<IReservation> = createReservation(
        buildRequest(resourceId, BASE_END, BASE_START),
      );

      await expect(attempt).rejects.toBeInstanceOf(ReservationValidationError);
      await expect(attempt).rejects.toThrow('endTime must be after startTime.');
      expect(await Reservation.countDocuments()).toBe(0);
    });

    it('rejects a reservation whose endTime equals startTime', async (): Promise<void> => {
      const attempt: Promise<IReservation> = createReservation(
        buildRequest(resourceId, BASE_START, BASE_START),
      );

      await expect(attempt).rejects.toBeInstanceOf(ReservationValidationError);
    });

    it('rejects a well-formed resourceId that does not exist', async (): Promise<void> => {
      const missingId: string = new Types.ObjectId().toHexString();

      const attempt: Promise<IReservation> = createReservation(
        buildRequest(missingId, BASE_START, BASE_END),
      );

      await expect(attempt).rejects.toBeInstanceOf(ReservationValidationError);
      await expect(attempt).rejects.toThrow('resourceId does not match an existing resource.');
      expect(await Reservation.countDocuments()).toBe(0);
    });

    it('rejects a malformed resourceId', async (): Promise<void> => {
      const attempt: Promise<IReservation> = createReservation(
        buildRequest('not-an-object-id', BASE_START, BASE_END),
      );

      await expect(attempt).rejects.toThrow('resourceId must be a valid resource id.');
    });

    it('rejects cancelling a non-existent reservation', async (): Promise<void> => {
      const missingId: string = new Types.ObjectId().toHexString();

      await expect(cancelReservation(missingId)).rejects.toBeInstanceOf(
        ReservationNotFoundError,
      );
    });

    it('rejects a reservation that starts 1 ms before an existing one ends', async (): Promise<void> => {
      await createReservation(buildRequest(resourceId, BASE_START, BASE_END));
      const overlapStart: Date = new Date(BASE_END.getTime() - 1);
      const overlapEnd: Date = new Date(BASE_END.getTime() + 60 * 60 * 1000);

      const attempt: Promise<IReservation> = createReservation(
        buildRequest(resourceId, overlapStart, overlapEnd, 'user-2'),
      );

      await expect(attempt).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('rejects a reservation that ends 1 ms after an existing one starts', async (): Promise<void> => {
      await createReservation(buildRequest(resourceId, BASE_START, BASE_END));
      const overlapStart: Date = new Date(BASE_START.getTime() - 60 * 60 * 1000);
      const overlapEnd: Date = new Date(BASE_START.getTime() + 1);

      const attempt: Promise<IReservation> = createReservation(
        buildRequest(resourceId, overlapStart, overlapEnd, 'user-2'),
      );

      await expect(attempt).rejects.toBeInstanceOf(ReservationConflictError);
    });

    it('allows back-to-back reservations that touch but do not overlap', async (): Promise<void> => {
      await createReservation(buildRequest(resourceId, BASE_START, BASE_END));
      const nextEnd: Date = new Date(BASE_END.getTime() + 60 * 60 * 1000);

      const result: IReservation = await createReservation(
        buildRequest(resourceId, BASE_END, nextEnd, 'user-2'),
      );

      expect(result.startTime).toBe(BASE_END.toISOString());
      expect(await Reservation.countDocuments({ resourceId })).toBe(2);
    });
  });

  describe('request validation', (): void => {
    it.each<[string, unknown]>([
      ['a null body', null],
      ['a non-object body', 'not-an-object'],
      ['a body missing userId', { resourceId: 'x', startTime: 'a', endTime: 'b' }],
      ['a body with an empty userId', { resourceId: 'x', userId: '  ', startTime: 'a', endTime: 'b' }],
    ])('rejects %s', async (_label: string, body: unknown): Promise<void> => {
      await expect(createReservation(body)).rejects.toBeInstanceOf(ReservationValidationError);
    });

    it('rejects start/end times that are not valid date-times', async (): Promise<void> => {
      const attempt: Promise<IReservation> = createReservation({
        resourceId,
        userId: 'user-1',
        startTime: 'not-a-date',
        endTime: BASE_END.toISOString(),
      });

      await expect(attempt).rejects.toThrow('startTime and endTime must be ISO 8601 date-times.');
    });
  });

  describe('listReservationsForUser', (): void => {
    it("returns only the given user's reservations", async (): Promise<void> => {
      const nextEnd: Date = new Date(BASE_END.getTime() + 60 * 60 * 1000);
      await createReservation(buildRequest(resourceId, BASE_START, BASE_END, 'user-1'));
      await createReservation(buildRequest(resourceId, BASE_END, nextEnd, 'user-2'));

      const result: IReservation[] = await listReservationsForUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe('user-1');
    });

    it('returns an empty list for a user with no reservations', async (): Promise<void> => {
      expect(await listReservationsForUser('nobody')).toEqual([]);
    });
  });

  describe('status transitions', (): void => {
    it('confirms a PENDING reservation', async (): Promise<void> => {
      const created: IReservation = await createReservation(
        buildRequest(resourceId, BASE_START, BASE_END),
      );

      const confirmed: IReservation = await confirmReservation(created.id);

      expect(confirmed.status).toBe('CONFIRMED');
    });

    it('rejects confirming a CANCELLED reservation', async (): Promise<void> => {
      const created: IReservation = await createReservation(
        buildRequest(resourceId, BASE_START, BASE_END),
      );
      await cancelReservation(created.id);

      const attempt: Promise<IReservation> = confirmReservation(created.id);

      await expect(attempt).rejects.toBeInstanceOf(ReservationConflictError);
      await expect(attempt).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('rejects a malformed reservation id', async (): Promise<void> => {
      await expect(cancelReservation('not-an-object-id')).rejects.toThrow(
        'id must be a valid reservation id.',
      );
    });
  });
});

describe('resource.service', (): void => {
  describe('createResource validation', (): void => {
    it.each<[string, unknown]>([
      ['a null body', null],
      ['an empty name', { name: ' ', type: 'ROOM', location: 'Snell' }],
      ['a missing location', { name: 'Room', type: 'ROOM' }],
      ['an unknown type', { name: 'Room', type: 'GYM', location: 'Snell' }],
      ['a non-string type', { name: 'Room', type: 1, location: 'Snell' }],
      ['a non-boolean isAvailable', { name: 'Room', type: 'ROOM', location: 'Snell', isAvailable: 'yes' }],
    ])('rejects %s', async (_label: string, body: unknown): Promise<void> => {
      await expect(createResource(body)).rejects.toBeInstanceOf(ResourceValidationError);
      expect(await Resource.countDocuments()).toBe(0);
    });

    it('stores an explicit isAvailable value', async (): Promise<void> => {
      const created: IResource = await createResource({
        name: 'Projector',
        type: 'EQUIPMENT',
        location: 'Curry',
        isAvailable: false,
      });

      expect(created.isAvailable).toBe(false);
    });
  });

  describe('listResources', (): void => {
    it('rejects an unknown type filter', async (): Promise<void> => {
      await expect(listResources({ type: 'GYM' })).rejects.toBeInstanceOf(
        ResourceValidationError,
      );
    });

    it('rejects a non-boolean isAvailable filter', async (): Promise<void> => {
      await expect(listResources({ isAvailable: 'maybe' })).rejects.toThrow(
        'isAvailable must be true or false.',
      );
    });
  });
});
