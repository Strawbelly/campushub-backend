import { Request, RequestHandler, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { listResources as listResourcesService } from '../services/resource.service';
import { IListResourcesQuery, IResource } from '../types/reservation';

export const listResources: RequestHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query: IListResourcesQuery = {};
    if (typeof req.query.type === 'string') {
      query.type = req.query.type;
    }
    if (typeof req.query.isAvailable === 'string') {
      query.isAvailable = req.query.isAvailable;
    }

    const resources: IResource[] = await listResourcesService(query);
    res.status(200).json(resources);
  },
);
