import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { cancelReservation, fetchResources, fetchUserReservations } from '../api/campushubApi';
import type { Reservation, ReservationStatus, Resource } from '../api/campushubApi';
import styles from './UserReservations.module.css';

interface UserReservationsProps {
  userId: string;
  /** Change this value to force a reload, e.g. after a new booking. */
  refreshKey?: number;
}

const ACTIVE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

interface ReservationsResult {
  key: string;
  reservations: Reservation[];
  resourcesById: Map<string, Resource>;
  error: string | null;
}

interface UseUserReservationsState {
  reservations: Reservation[];
  resourcesById: Map<string, Resource>;
  loading: boolean;
  error: string | null;
  cancellingId: string | null;
  cancelError: string | null;
  cancel: (reservationId: string) => void;
}

const toMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.';

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// Loads the user's active reservations and reloads them after a cancellation.
// A result is only shown once it matches the request it was made for.
const useUserReservations = (userId: string, refreshKey: number): UseUserReservationsState => {
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

export function UserReservations({ userId, refreshKey = 0 }: UserReservationsProps): JSX.Element {
  const { reservations, resourcesById, loading, error, cancellingId, cancelError, cancel } =
    useUserReservations(userId, refreshKey);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>My Bookings</h2>

      {loading && reservations.length === 0 && <p className={styles.status}>Loading bookings…</p>}
      {error !== null && <p className={styles.error} role="alert">{error}</p>}
      {cancelError !== null && <p className={styles.error} role="alert">{cancelError}</p>}
      {!loading && error === null && reservations.length === 0 && (
        <p className={styles.status}>You have no active bookings.</p>
      )}

      <ul className={styles.list}>
        {reservations.map((reservation: Reservation) => {
          const resource: Resource | undefined = resourcesById.get(reservation.resourceId);
          return (
            <li key={reservation.id} className={styles.item}>
              <div className={styles.details}>
                <span className={styles.time}>
                  {formatDateTime(reservation.startTime)} – {formatDateTime(reservation.endTime)}
                </span>
                <span className={styles.resource}>
                  {resource !== undefined
                    ? `${resource.name} · ${resource.location}`
                    : `Resource ${reservation.resourceId}`}
                </span>
              </div>
              <span
                className={
                  reservation.status === 'CONFIRMED' ? styles.badgeConfirmed : styles.badgePending
                }
              >
                {reservation.status}
              </span>
              <button
                type="button"
                className={styles.cancel}
                disabled={cancellingId !== null}
                onClick={(): void => cancel(reservation.id)}
              >
                {cancellingId === reservation.id ? 'Cancelling…' : 'Cancel Reservation'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
