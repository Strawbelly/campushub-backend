import { Router } from 'express';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listReservationsByUser,
} from '../controllers/reservation.controller';
import { listResources } from '../controllers/resource.controller';

const router: Router = Router();

router.get('/resources', listResources);
router.post('/reservations', createReservation);
router.get('/reservations/user/:userId', listReservationsByUser);
router.patch('/reservations/:id/confirm', confirmReservation);
router.patch('/reservations/:id/cancel', cancelReservation);

export default router;
