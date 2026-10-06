import { NextFunction, Request, Response } from 'express';
import {
  listResources as listResourcesService,
  ResourceValidationError,
} from '../services/resource.service';
import { IErrorResponse, IResource } from '../types/reservation';

export const listResources = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const type: string | undefined =
    typeof req.query.type === 'string' ? req.query.type : undefined;

  try {
    const resources: IResource[] = await listResourcesService(type);
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
