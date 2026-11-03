import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import type { Reservation, Resource } from '../api/campushubApi';
import { useBooking } from '../hooks/useReservations';
import styles from './BookingForm.module.css';

interface BookingFormProps {
  resource: Resource;
  userId: string;
  /** Called with the new reservation after the server accepts the booking. */
  onBooked?: (reservation: Reservation) => void;
}

interface BookingInput {
  startTime: string;
  endTime: string;
}

// Returns an error message for invalid input, or null when it can be sent.
// `datetime-local` values have no timezone, so they are read as local time.
const validateBooking = (input: BookingInput, now: Date): string | null => {
  if (input.startTime === '' || input.endTime === '') {
    return 'Please choose both a start and an end time.';
  }
  const start: Date = new Date(input.startTime);
  const end: Date = new Date(input.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Please enter valid dates and times.';
  }
  if (start <= now) {
    return 'The start time must be in the future.';
  }
  if (end <= start) {
    return 'The end time must be after the start time.';
  }
  return null;
};

export function BookingForm({ resource, userId, onBooked }: BookingFormProps): JSX.Element {
  const [input, setInput] = useState<BookingInput>({ startTime: '', endTime: '' });
  const { submitting, error, success, submit, reportError } = useBooking(onBooked);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const validationError: string | null = validateBooking(input, new Date());
    if (validationError !== null) {
      reportError(validationError);
      return;
    }
    submit({
      resourceId: resource.id,
      userId,
      startTime: new Date(input.startTime).toISOString(),
      endTime: new Date(input.endTime).toISOString(),
    }, (): void => setInput({ startTime: '', endTime: '' }));
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.heading}>Book {resource.name}</h2>
      <p className={styles.location}>{resource.location}</p>

      <label className={styles.field}>
        <span>Start time</span>
        <input
          type="datetime-local"
          value={input.startTime}
          onChange={(e): void => setInput({ ...input, startTime: e.target.value })}
          required
        />
      </label>

      <label className={styles.field}>
        <span>End time</span>
        <input
          type="datetime-local"
          value={input.endTime}
          min={input.startTime || undefined}
          onChange={(e): void => setInput({ ...input, endTime: e.target.value })}
          required
        />
      </label>

      {error !== null && <p className={styles.error} role="alert">{error}</p>}
      {success !== null && <p className={styles.success} role="status">{success}</p>}

      <button type="submit" className={styles.submit} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Request booking'}
      </button>
    </form>
  );
}
