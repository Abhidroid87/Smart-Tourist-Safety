import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('RAG Service Error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message || 'Something went wrong'
  });
};