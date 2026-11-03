import { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncController<P> = (req: Request<P>, res: Response) => Promise<void>;

// Forwards a rejected controller promise to the central error handler, so
// controllers need no try/catch of their own.
export const asyncHandler =
  <P>(controller: AsyncController<P>): RequestHandler<P> =>
  (req: Request<P>, res: Response, next: NextFunction): void => {
    controller(req, res).catch(next);
  };
