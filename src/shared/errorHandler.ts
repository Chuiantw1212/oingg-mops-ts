import { Request, Response, NextFunction } from 'ultimate-express';

// A simple interface for HTTP errors
interface HttpError extends Error {
  status?: number;
}

const errorHandler = (err: HttpError, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong on the server.';

  // In production, you might not want to send the detailed error message to the client
  res.status(status).send({ status, message });
};

export default errorHandler;