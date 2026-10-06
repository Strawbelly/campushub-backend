import { Schema, model, Document, Model, Types } from 'mongoose';
import { RESERVATION_STATUSES, ReservationStatus } from '../types/reservation';

// Persistence shape. Named *Document to avoid clashing with the wire-format
// IReservation in src/types/reservation.ts.
export interface IReservationDocument extends Document {
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const reservationSchema = new Schema<IReservationDocument>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    userId:     { type: String, required: true, trim: true },
    startTime:  { type: Date, required: true },
    endTime:    { type: Date, required: true },
    status:     { type: String, required: true, enum: RESERVATION_STATUSES, default: 'PENDING' },
  },
);

export const Reservation: Model<IReservationDocument> = model<IReservationDocument>(
  'Reservation',
  reservationSchema,
);
