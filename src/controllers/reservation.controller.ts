import { NextFunction, Request, Response } from 'express';
import {
  cancelReservation as cancelReservationService,
  confirmReservation as confirmReservationService,
  createReservation as createReservationService,
  listReservationsForUser,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
} from '../services/reservation.service';
import {
  IErrorResponse,
  IReservation,
  IReservationIdParams,
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
    const reservations: IReservation[] = await listReservationsForUser(
      req.params.userId,
    );
    res.status(200).json(reservations);
  } catch (err: unknown) {
    next(err);
  }
};

const sendStatusChange = async (
  changeStatus: (id: string) => Promise<IReservation>,
  req: Request<IReservationIdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reservation: IReservation = await changeStatus(req.params.id);
    res.status(200).json(reservation);
  } catch (err: unknown) {
    if (err instanceof ReservationNotFoundError) {
      sendError(res, 404, { code: err.code, message: err.message });
      return;
    }
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

export const confirmReservation = async (
  req: Request<IReservationIdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> => sendStatusChange(confirmReservationService, req, res, next);

export const cancelReservation = async (
  req: Request<IReservationIdParams>,
  res: Response,
  next: NextFunction,
): Promise<void> => sendStatusChange(cancelReservationService, req, res, next);
