// Typed client for the CampusHub Reservation API, following docs/openapi.yaml.
// Date-time fields are ISO 8601 strings as they appear in JSON, not Date objects.

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  /** ISO 8601 date-time */
  startTime: string;
  /** ISO 8601 date-time */
  endTime: string;
  status: ReservationStatus;
}

export interface ErrorResponse {
  code: string;
  message: string;
}

/** POST /reservations request body — `id` and `status` are assigned by the server. */
export type CreateReservationDTO = Pick<
  Reservation,
  'resourceId' | 'userId' | 'startTime' | 'endTime'
>;

/** Thrown for any non-2xx response; carries the spec's ErrorResponse fields. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isResource = (value: unknown): value is Resource =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.type === 'string' &&
  (RESOURCE_TYPES as readonly string[]).includes(value.type) &&
  typeof value.location === 'string' &&
  typeof value.isAvailable === 'boolean';

const isReservation = (value: unknown): value is Reservation =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.resourceId === 'string' &&
  typeof value.userId === 'string' &&
  typeof value.startTime === 'string' &&
  typeof value.endTime === 'string' &&
  typeof value.status === 'string' &&
  (RESERVATION_STATUSES as readonly string[]).includes(value.status);

const isErrorResponse = (value: unknown): value is ErrorResponse =>
  isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';

const isArrayOf =
  <T>(guard: (item: unknown) => item is T) =>
  (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(guard);

// Sends the request, maps error responses to ApiError, and checks the success
// body against the expected shape.
const request = async <T>(
  path: string,
  guard: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T> => {
  const response: Response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (err: unknown) {
    if (response.ok) {
      const detail: string = err instanceof Error ? err.message : String(err);
      throw new ApiError(response.status, 'INVALID_RESPONSE', `Response was not valid JSON: ${detail}`);
    }
  }

  if (!response.ok) {
    if (isErrorResponse(body)) {
      throw new ApiError(response.status, body.code, body.message);
    }
    throw new ApiError(response.status, 'HTTP_ERROR', `Request failed with status ${response.status}.`);
  }

  if (!guard(body)) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Response body did not match the API schema.');
  }
  return body;
};

/** GET /resources — optionally filtered by resource type. */
export const fetchResources = async (type?: ResourceType): Promise<Resource[]> => {
  const query: string = type === undefined ? '' : `?${new URLSearchParams({ type }).toString()}`;
  return request(`/resources${query}`, isArrayOf(isResource));
};

/** POST /reservations — 409 (as ApiError) if the slot is already reserved. */
export const createReservation = async (
  payload: CreateReservationDTO,
): Promise<Reservation> =>
  request('/reservations', isReservation, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/** GET /reservations/user/{userId} — all of the user's reservations, any status. */
export const fetchUserReservations = async (userId: string): Promise<Reservation[]> =>
  request(`/reservations/user/${encodeURIComponent(userId)}`, isArrayOf(isReservation));

/** PATCH /reservations/{id}/cancel — returns the reservation with status CANCELLED. */
export const cancelReservation = async (reservationId: string): Promise<Reservation> =>
  request(`/reservations/${encodeURIComponent(reservationId)}/cancel`, isReservation, {
    method: 'PATCH',
  });
