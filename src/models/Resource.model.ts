import { Schema, model, Document, Model } from 'mongoose';
import { RESOURCE_TYPES, ResourceType } from '../types/reservation';

// Persistence shape. Named *Document to avoid clashing with the wire-format
// IResource in src/types/reservation.ts.
export interface IResourceDocument extends Document {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

const resourceSchema = new Schema<IResourceDocument>(
  {
    name:        { type: String, required: true, trim: true },
    type:        { type: String, required: true, enum: RESOURCE_TYPES },
    location:    { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
  },
);

export const Resource: Model<IResourceDocument> = model<IResourceDocument>(
  'Resource',
  resourceSchema,
);
