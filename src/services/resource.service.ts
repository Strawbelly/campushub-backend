import { IResourceDocument, Resource } from '../models/Resource.model';
import {
  IListResourcesQuery,
  IResource,
  RESOURCE_TYPES,
  ResourceType,
} from '../types/reservation';

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

export interface ICreateResourceInput {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable?: boolean;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const createResource = async (body: unknown): Promise<IResource> => {
  if (typeof body !== 'object' || body === null) {
    throw new ResourceValidationError('Body must be an object.');
  }
  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.name) || !isNonEmptyString(candidate.location)) {
    throw new ResourceValidationError('name and location must be non-empty strings.');
  }
  if (typeof candidate.type !== 'string' || !isResourceType(candidate.type)) {
    throw new ResourceValidationError(`type must be one of ${RESOURCE_TYPES.join(', ')}.`);
  }
  if (candidate.isAvailable !== undefined && typeof candidate.isAvailable !== 'boolean') {
    throw new ResourceValidationError('isAvailable must be a boolean.');
  }

  const input: ICreateResourceInput = {
    name: candidate.name,
    type: candidate.type,
    location: candidate.location,
    ...(candidate.isAvailable !== undefined && { isAvailable: candidate.isAvailable }),
  };

  const doc: IResourceDocument = await Resource.create(input);
  return toResource(doc);
};

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
