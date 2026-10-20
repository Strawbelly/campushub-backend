import {
  IResourceDocument,
  Resource,
  RESOURCE_TYPES,
  ResourceType,
} from '../models/Resource.model';
import { IListResourcesQuery, IResource } from '../types/reservation';

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

interface IResourceFilter {
  type?: ResourceType;
  isAvailable?: boolean;
}

const isResourceType = (value: string): value is ResourceType =>
  (RESOURCE_TYPES as readonly string[]).includes(value);

export const listResources = async (
  query: IListResourcesQuery,
): Promise<IResource[]> => {
  const filter: IResourceFilter = {};

  if (query.type !== undefined) {
    if (!isResourceType(query.type)) {
      throw new ResourceValidationError(
        `type must be one of ${RESOURCE_TYPES.join(', ')}.`,
      );
    }
    filter.type = query.type;
  }

  if (query.isAvailable !== undefined) {
    if (query.isAvailable !== 'true' && query.isAvailable !== 'false') {
      throw new ResourceValidationError('isAvailable must be true or false.');
    }
    filter.isAvailable = query.isAvailable === 'true';
  }

  const docs: IResourceDocument[] = await Resource.find(filter);
  return docs.map(toResource);
};
