import { useState } from 'react';
import type { JSX } from 'react';
import type { Resource } from './api/campushubApi';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';

// PLACEHOLDER: the project has no authentication yet, so every booking is made
// as this fixed student. Replace with the signed-in user's ID once auth exists.
const CURRENT_USER_ID = 'demo-student-001';

function App(): JSX.Element {
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleBooked = (): void => {
    setRefreshKey((key: number): number => key + 1);
  };

  return (
    <main>
      <h1>CampusHub</h1>

      <ResourceList
        onSelectResource={setSelectedResource}
        selectedResourceId={selectedResource?.id}
      />

      {selectedResource !== null && (
        <BookingForm
          key={selectedResource.id}
          resource={selectedResource}
          userId={CURRENT_USER_ID}
          onBooked={handleBooked}
        />
      )}

      <UserReservations userId={CURRENT_USER_ID} refreshKey={refreshKey} />
    </main>
  );
}

export default App;
