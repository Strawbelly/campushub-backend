import { Request, Response } from 'express';
import { getHealthStatus, IHealthStatus } from '../services/health.service';

export const checkHealth = (_req: Request, res: Response): void => {
  const health: IHealthStatus = getHealthStatus();
  res.status(200).json(health);
};
