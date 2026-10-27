import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { fetchResources, RESOURCE_TYPES } from '../api/campushubApi';
import type { Resource, ResourceType } from '../api/campushubApi';
import styles from './ResourceList.module.css';

interface ResourceListProps {
  /** Called when the student picks an available resource to book. */
  onSelectResource?: (resource: Resource) => void;
  selectedResourceId?: string;
}

type TypeFilter = ResourceType | 'ALL';

const TYPE_LABELS: Record<ResourceType, string> = {
  ROOM: 'Study Room',
  EQUIPMENT: 'Equipment',
  LAB: 'Lab',
};

const FILTERS: readonly TypeFilter[] = ['ALL', ...RESOURCE_TYPES];

interface ResourcesResult {
  filter: TypeFilter;
  resources: Resource[];
  error: string | null;
}

interface UseResourcesState {
  resources: Resource[];
  loading: boolean;
  error: string | null;
}

const toMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Something went wrong.';

// Loads resources for the current filter; a result is only shown once it
// matches the filter it was requested for, so stale responses are ignored.
const useResources = (filter: TypeFilter): UseResourcesState => {
  const [result, setResult] = useState<ResourcesResult | null>(null);

  useEffect((): (() => void) => {
    let ignore = false;
    fetchResources(filter === 'ALL' ? undefined : filter)
      .then((resources: Resource[]): void => {
        if (!ignore) setResult({ filter, resources, error: null });
      })
      .catch((err: unknown): void => {
        if (!ignore) setResult({ filter, resources: [], error: toMessage(err) });
      });
    return (): void => {
      ignore = true;
    };
  }, [filter]);

  const current: ResourcesResult | null = result?.filter === filter ? result : null;
  return {
    resources: current?.resources ?? [],
    loading: current === null,
    error: current?.error ?? null,
  };
};

export function ResourceList({
  onSelectResource,
  selectedResourceId,
}: ResourceListProps): JSX.Element {
  const [filter, setFilter] = useState<TypeFilter>('ALL');
  const { resources, loading, error } = useResources(filter);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Campus Resources</h2>

      <div className={styles.filters} role="group" aria-label="Filter by resource type">
        {FILTERS.map((option: TypeFilter) => (
          <button
            key={option}
            type="button"
            className={option === filter ? `${styles.filter} ${styles.filterActive}` : styles.filter}
            aria-pressed={option === filter}
            onClick={(): void => setFilter(option)}
          >
            {option === 'ALL' ? 'All' : `${TYPE_LABELS[option]}s`}
          </button>
        ))}
      </div>

      {loading && <p className={styles.status}>Loading resources…</p>}
      {error !== null && <p className={styles.error} role="alert">{error}</p>}
      {!loading && error === null && resources.length === 0 && (
        <p className={styles.status}>No resources match this filter.</p>
      )}

      <ul className={styles.grid}>
        {resources.map((resource: Resource) => (
          <li
            key={resource.id}
            className={
              resource.id === selectedResourceId ? `${styles.card} ${styles.cardSelected}` : styles.card
            }
          >
            <span className={styles.type}>{TYPE_LABELS[resource.type]}</span>
            <h3 className={styles.name}>{resource.name}</h3>
            <p className={styles.location}>{resource.location}</p>
            <p className={resource.isAvailable ? styles.available : styles.unavailable}>
              {resource.isAvailable ? 'Available' : 'Unavailable'}
            </p>
            {onSelectResource !== undefined && (
              <button
                type="button"
                className={styles.book}
                disabled={!resource.isAvailable}
                onClick={(): void => onSelectResource(resource)}
              >
                Book
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
