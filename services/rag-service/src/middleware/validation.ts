import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema?: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Simple validation middleware - just pass through for now
    // In a real implementation, you would validate req.body against the schema
    next();
  };
};