import { NextFunction, Request, Response } from 'express';
import {
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
} from '../services/reservation.service';
import { ResourceValidationError } from '../services/resource.service';
import { IErrorResponse } from '../types/reservation';

// express.json() rejects malformed JSON with this error type; it is a client
// error, not a server failure.
const isJsonParseError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  (err as Record<string, unknown>).type === 'entity.parse.failed';

type DomainError =
  | ReservationValidationError
  | ResourceValidationError
  | ReservationNotFoundError
  | ReservationConflictError;

const isDomainError = (err: unknown): err is DomainError =>
  err instanceof ReservationValidationError ||
  err instanceof ResourceValidationError ||
  err instanceof ReservationNotFoundError ||
  err instanceof ReservationConflictError;

// HTTP status for each domain error the services throw.
const statusForDomainError = (err: DomainError): number => {
  if (err instanceof ReservationNotFoundError) {
    return 404;
  }
  if (err instanceof ReservationConflictError) {
    return 409;
  }
  return 400;
};

// Final error handler: anything controllers forward with next(err) ends here.
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (isDomainError(err)) {
    const error: IErrorResponse = { code: err.code, message: err.message };
    res.status(statusForDomainError(err)).json(error);
    return;
  }

  if (isJsonParseError(err)) {
    const error: IErrorResponse = {
      code: 'VALIDATION_ERROR',
      message: 'Request body must be valid JSON.',
    };
    res.status(400).json(error);
    return;
  }

  const detail: string = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`Unhandled error: ${detail}\n`);

  const error: IErrorResponse = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  };
  res.status(500).json(error);
};
