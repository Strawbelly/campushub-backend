import { randomUUID } from 'crypto';
import {
  ICreateReservationRequest,
  IReservation,
} from '../types/reservation';

// TEMPORARY in-memory store: stands in for a Mongoose model until persistence
// is added. Data is lost on restart and is not shared across processes.
const reservations: Map<string, IReservation> = new Map<string, IReservation>();

export class ReservationValidationError extends Error {
  public readonly code: string = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ReservationValidationError';
  }
}

export class ReservationConflictError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ReservationConflictError';
    this.code = code;
  }
}

const isActive = (reservation: IReservation): boolean =>
  reservation.status !== 'CANCELLED';

const overlaps = (a: IReservation, startMs: number, endMs: number): boolean =>
  Date.parse(a.startTime) < endMs && startMs < Date.parse(a.endTime);

export const createReservation = async (
  input: ICreateReservationRequest,
): Promise<IReservation> => {
  const startMs: number = Date.parse(input.startTime);
  const endMs: number = Date.parse(input.endTime);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new ReservationValidationError('startTime and endTime must be ISO 8601 date-times.');
  }
  if (endMs <= startMs) {
    throw new ReservationValidationError('endTime must be after startTime.');
  }
  for (const existing of reservations.values()) {
    if (
      existing.resourceId === input.resourceId &&
      isActive(existing) &&
      overlaps(existing, startMs, endMs)
    ) {
      throw new ReservationConflictError(
        'RESERVATION_CONFLICT',
        'Resource is already reserved for the requested time period.',
      );
    }
  }

  const reservation: IReservation = { id: randomUUID(), ...input, status: 'PENDING' };
  reservations.set(reservation.id, reservation);
  return reservation;
};

export const listActiveReservationsForUser = async (
  userId: string,
): Promise<IReservation[]> => {
  return [...reservations.values()].filter(
    (reservation: IReservation): boolean =>
      reservation.userId === userId && isActive(reservation),
  );
};
