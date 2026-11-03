import type { JSX } from 'react';
import type { Reservation, Resource } from '../api/campushubApi';
import { useUserReservations } from '../hooks/useReservations';
import styles from './UserReservations.module.css';

interface UserReservationsProps {
  userId: string;
  /** Change this value to force a reload, e.g. after a new booking. */
  refreshKey?: number;
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

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
