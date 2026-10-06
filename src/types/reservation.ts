// Wire-format types generated from docs/openapi.yaml (components/schemas).
// Date-time fields are ISO 8601 strings as they appear in JSON, not Date objects.

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface IResource {
  id: string;
  name: string;
  type: string;
  location: string;
  isAvailable: boolean;
}

export interface IReservation {
  id: string;
  resourceId: string;
  userId: string;
  /** ISO 8601 date-time */
  startTime: string;
  /** ISO 8601 date-time */
  endTime: string;
  status: ReservationStatus;
}

export interface IErrorResponse {
  code: string;
  message: string;
}

/** POST /reservations request body — `id` and `status` are assigned by the server. */
export type ICreateReservationRequest = Pick<
  IReservation,
  'resourceId' | 'userId' | 'startTime' | 'endTime'
>;

/** GET /resources query parameters. */
export interface IListResourcesQuery {
  type?: string;
}

/** GET /reservations/user/{userId} path parameters. */
export interface IUserReservationsParams {
  userId: string;
}
