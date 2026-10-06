import { NextFunction, Request, Response } from 'express';
import {
  createReservation as createReservationService,
  listActiveReservationsForUser,
  ReservationConflictError,
  ReservationValidationError,
} from '../services/reservation.service';
import {
  IErrorResponse,
  IReservation,
  IUserReservationsParams,
} from '../types/reservation';

const sendError = (res: Response, status: number, error: IErrorResponse): void => {
  res.status(status).json(error);
};

export const createReservation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const body: unknown = req.body;

  try {
    const reservation: IReservation = await createReservationService(body);
    res.status(201).json(reservation);
  } catch (err: unknown) {
    if (err instanceof ReservationConflictError) {
      sendError(res, 409, { code: err.code, message: err.message });
      return;
    }
    if (err instanceof ReservationValidationError) {
      sendError(res, 400, { code: err.code, message: err.message });
      return;
    }
    next(err);
  }
};

export const listReservationsByUser = async (
  req: Request<IUserReservationsParams>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reservations: IReservation[] = await listActiveReservationsForUser(
      req.params.userId,
    );
    res.status(200).json(reservations);
  } catch (err: unknown) {
    next(err);
  }
};
