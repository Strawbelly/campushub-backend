import { NextFunction, Request, Response } from 'express';
import { listResources as listResourcesService } from '../services/resource.service';
import { IErrorResponse, IResource } from '../types/reservation';

export const listResources = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const type: string | undefined =
    typeof req.query.type === 'string' ? req.query.type : undefined;

  if (type === '') {
    const error: IErrorResponse = {
      code: 'VALIDATION_ERROR',
      message: 'type must be a non-empty string when provided.',
    };
    res.status(400).json(error);
    return;
  }

  try {
    const resources: IResource[] = await listResourcesService(type);
    res.status(200).json(resources);
  } catch (err: unknown) {
    next(err);
  }
};
