import { IResourceDocument, Resource } from '../models/Resource.model';
import { IResource } from '../types/reservation';

export class ResourceValidationError extends Error {
  public readonly code: string = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ResourceValidationError';
  }
}

const toResource = (doc: IResourceDocument): IResource => ({
  id: String(doc._id),
  name: doc.name,
  type: doc.type,
  location: doc.location,
  isAvailable: doc.isAvailable,
});

export const listResources = async (
  type: string | undefined,
): Promise<IResource[]> => {
  if (type === '') {
    throw new ResourceValidationError('type must be a non-empty string when provided.');
  }
  const docs: IResourceDocument[] =
    type === undefined
      ? await Resource.find()
      : await Resource.find().where('type').equals(type);
  return docs.map(toResource);
};
