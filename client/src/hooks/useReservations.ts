import { useEffect, useState } from 'react';
import {
  ApiError,
  cancelReservation,
  createReservation,
  fetchResources,
  fetchUserReservations,
} from '../api/campushubApi';
import type {
  CreateReservationDTO,
  Reservation,
  ReservationStatus,
  Resource,
} from '../api/campushubApi';

const ACTIVE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

const toMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.';

const toBookingMessage = (err: unknown): string => {
  if (err instanceof ApiError && err.status === 409) {
    return 'That time slot is already reserved. Please choose another time.';
  }
  return toMessage(err);
};

export interface UseBookingState {
  submitting: boolean;
  error: string | null;
  success: string | null;
  submit: (payload: CreateReservationDTO, onSuccess: () => void) => void;
  reportError: (message: string) => void;
}

// Submits a new reservation and tracks its submitting/error/success state.
export const useBooking = (onBooked?: (reservation: Reservation) => void): UseBookingState => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = (payload: CreateReservationDTO, onSuccess: () => void): void => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    createReservation(payload)
      .then((reservation: Reservation): void => {
        setSuccess(`Booking request submitted (status: ${reservation.status}).`);
        onSuccess();
        onBooked?.(reservation);
      })
      .catch((err: unknown): void => {
        setError(toBookingMessage(err));
      })
      .finally((): void => {
        setSubmitting(false);
      });
  };

  const reportError = (message: string): void => {
    setSuccess(null);
    setError(message);
  };

  return { submitting, error, success, submit, reportError };
};

interface ReservationsResult {
  key: string;
  reservations: Reservation[];
  resourcesById: Map<string, Resource>;
  error: string | null;
}

export interface UseUserReservationsState {
  reservations: Reservation[];
  resourcesById: Map<string, Resource>;
  loading: boolean;
  error: string | null;
  cancellingId: string | null;
  cancelError: string | null;
  cancel: (reservationId: string) => void;
}

// Loads the user's active reservations and reloads them after a cancellation.
// A result is only shown once it matches the request it was made for.
export const useUserReservations = (
  userId: string,
  refreshKey: number,
): UseUserReservationsState => {
  const [version, setVersion] = useState<number>(0);
  const [result, setResult] = useState<ReservationsResult | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const key: string = `${userId}:${refreshKey}:${version}`;

  useEffect((): (() => void) => {
    let ignore = false;
    // Resource details are only for display: if they fail to load, the list
    // still shows and falls back to the resource ID.
    const resourcesRequest: Promise<Resource[]> = fetchResources().catch(
      (): Resource[] => [],
    );
    Promise.all([fetchUserReservations(userId), resourcesRequest])
      .then(([all, resources]: [Reservation[], Resource[]]): void => {
        const reservations: Reservation[] = all.filter((r: Reservation): boolean =>
          ACTIVE_STATUSES.includes(r.status),
        );
        const resourcesById: Map<string, Resource> = new Map(
          resources.map((resource: Resource): [string, Resource] => [resource.id, resource]),
        );
        if (!ignore) setResult({ key, reservations, resourcesById, error: null });
      })
      .catch((err: unknown): void => {
        if (!ignore) {
          setResult({ key, reservations: [], resourcesById: new Map(), error: toMessage(err) });
        }
      });
    return (): void => {
      ignore = true;
    };
  }, [key, userId]);

  const cancel = (reservationId: string): void => {
    setCancellingId(reservationId);
    setCancelError(null);
    cancelReservation(reservationId)
      .then((): void => {
        setVersion((v: number): number => v + 1);
      })
      .catch((err: unknown): void => {
        setCancelError(toMessage(err));
      })
      .finally((): void => {
        setCancellingId(null);
      });
  };

  // Keep showing the previous list while a refresh is in flight.
  const loading: boolean = result?.key !== key;
  return {
    reservations: result?.reservations ?? [],
    resourcesById: result?.resourcesById ?? new Map(),
    loading,
    error: result?.error ?? null,
    cancellingId,
    cancelError,
    cancel,
  };
};
