import { Request, Response, NextFunction } from 'express';

export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  // Simple API key validation - just pass through for now
  // In a real implementation, you would validate the API key from headers
  next();
};