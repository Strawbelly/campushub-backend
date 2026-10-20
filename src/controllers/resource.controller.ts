import { NextFunction, Request, Response } from 'express';
import {
  listResources as listResourcesService,
  ResourceValidationError,
} from '../services/resource.service';
import { IErrorResponse, IListResourcesQuery, IResource } from '../types/reservation';

export const listResources = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const query: IListResourcesQuery = {};
  if (typeof req.query.type === 'string') {
    query.type = req.query.type;
  }
  if (typeof req.query.isAvailable === 'string') {
    query.isAvailable = req.query.isAvailable;
  }

  try {
    const resources: IResource[] = await listResourcesService(query);
    res.status(200).json(resources);
  } catch (err: unknown) {
    if (err instanceof ResourceValidationError) {
      const error: IErrorResponse = { code: err.code, message: err.message };
      res.status(400).json(error);
      return;
    }
    next(err);
  }
};
