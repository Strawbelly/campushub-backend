import { isObjectIdOrHexString } from 'mongoose';
import { IReservationDocument, Reservation } from '../models/Reservation.model';
import { Resource } from '../models/Resource.model';
import {
  ICreateReservationRequest,
  IReservation,
} from '../types/reservation';

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

const toReservation = (doc: IReservationDocument): IReservation => ({
  id: String(doc._id),
  resourceId: doc.resourceId.toString(),
  userId: doc.userId,
  startTime: doc.startTime.toISOString(),
  endTime: doc.endTime.toISOString(),
  status: doc.status,
});

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isCreateReservationRequest = (
  body: unknown,
): body is ICreateReservationRequest => {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const candidate = body as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.resourceId) &&
    isNonEmptyString(candidate.userId) &&
    isNonEmptyString(candidate.startTime) &&
    isNonEmptyString(candidate.endTime)
  );
};

export const createReservation = async (
  body: unknown,
): Promise<IReservation> => {
  if (!isCreateReservationRequest(body)) {
    throw new ReservationValidationError(
      'Body must include string resourceId, userId, startTime and endTime.',
    );
  }
  const input: ICreateReservationRequest = {
    resourceId: body.resourceId,
    userId: body.userId,
    startTime: body.startTime,
    endTime: body.endTime,
  };

  const startTime: Date = new Date(input.startTime);
  const endTime: Date = new Date(input.endTime);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new ReservationValidationError('startTime and endTime must be ISO 8601 date-times.');
  }
  if (endTime <= startTime) {
    throw new ReservationValidationError('endTime must be after startTime.');
  }
  if (!isObjectIdOrHexString(input.resourceId)) {
    throw new ReservationValidationError('resourceId must be a valid resource id.');
  }
  if ((await Resource.exists({ _id: input.resourceId })) === null) {
    throw new ReservationValidationError('resourceId does not match an existing resource.');
  }

  // Two active reservations overlap when each starts before the other ends.
  const hasConflict: boolean =
    (await Reservation.exists({
      resourceId: input.resourceId,
      status: { $ne: 'CANCELLED' },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    })) !== null;
  if (hasConflict) {
    throw new ReservationConflictError(
      'RESERVATION_CONFLICT',
      'Resource is already reserved for the requested time period.',
    );
  }

  const doc: IReservationDocument = await Reservation.create({
    resourceId: input.resourceId,
    userId: input.userId,
    startTime,
    endTime,
    status: 'PENDING',
  });
  return toReservation(doc);
};

export const listActiveReservationsForUser = async (
  userId: string,
): Promise<IReservation[]> => {
  const docs: IReservationDocument[] = await Reservation.find({
    userId,
    status: { $ne: 'CANCELLED' },
  });
  return docs.map(toReservation);
};
