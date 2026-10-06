import { NextFunction, Request, Response } from 'express';
import { IErrorResponse } from '../types/reservation';

// express.json() rejects malformed JSON with this error type; it is a client
// error, not a server failure.
const isJsonParseError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  (err as Record<string, unknown>).type === 'entity.parse.failed';

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
