import { Request, RequestHandler, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  cancelReservation as cancelReservationService,
  confirmReservation as confirmReservationService,
  createReservation as createReservationService,
  listReservationsForUser,
} from '../services/reservation.service';
import {
  IReservation,
  IReservationIdParams,
  IUserReservationsParams,
} from '../types/reservation';

export const createReservation: RequestHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;
    const reservation: IReservation = await createReservationService(body);
    res.status(201).json(reservation);
  },
);

export const listReservationsByUser: RequestHandler<IUserReservationsParams> = asyncHandler(
  async (req: Request<IUserReservationsParams>, res: Response): Promise<void> => {
    const reservations: IReservation[] = await listReservationsForUser(req.params.userId);
    res.status(200).json(reservations);
  },
);

const statusChangeHandler = (
  changeStatus: (id: string) => Promise<IReservation>,
): RequestHandler<IReservationIdParams> =>
  asyncHandler(async (req: Request<IReservationIdParams>, res: Response): Promise<void> => {
    const reservation: IReservation = await changeStatus(req.params.id);
    res.status(200).json(reservation);
  });

export const confirmReservation: RequestHandler<IReservationIdParams> =
  statusChangeHandler(confirmReservationService);

export const cancelReservation: RequestHandler<IReservationIdParams> =
  statusChangeHandler(cancelReservationService);
