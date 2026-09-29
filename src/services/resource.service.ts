import { IResource } from '../types/reservation';

// TEMPORARY in-memory resource list: stands in for a Mongoose model until
// persistence is added.
const resources: readonly IResource[] = [
  { id: 'res-001', name: 'Study Room 101', type: 'ROOM', isAvailable: true },
  { id: 'res-002', name: 'Conference Room 204', type: 'ROOM', isAvailable: false },
  { id: 'res-003', name: 'Portable Projector', type: 'EQUIPMENT', isAvailable: true },
  { id: 'res-004', name: 'Chemistry Lab A', type: 'LAB', isAvailable: true },
  { id: 'res-005', name: 'Library Study Room 3', type: 'STUDY_ROOM', isAvailable: true },
];

export const listResources = async (
  type: string | undefined,
): Promise<IResource[]> => {
  if (type === undefined) {
    return [...resources];
  }
  return resources.filter((resource: IResource): boolean => resource.type === type);
};
