import { Router } from 'express';
import {
  createReservation,
  listReservationsByUser,
} from '../controllers/reservation.controller';
import { listResources } from '../controllers/resource.controller';

const router: Router = Router();

router.get('/resources', listResources);
router.post('/reservations', createReservation);
router.get('/reservations/user/:userId', listReservationsByUser);

export default router;
