import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  const errorObj = err as {
    name?: string;
    code?: number;
    keyValue?: Record<string, unknown>;
    errors?: Record<string, { message: string }>;
    message?: string;
  };

  if (errorObj?.name === 'ValidationError' && errorObj.errors) {
    const messages = Object.values(errorObj.errors).map((e) => e.message);
    res.status(400).json({ message: messages[0] || 'Validation failed', errors: messages });
    return;
  }

  if (errorObj?.code === 11000 && errorObj.keyValue) {
    const field = Object.keys(errorObj.keyValue)[0];
    res.status(409).json({ message: `A record with that ${field} already exists.` });
    return;
  }

  if (errorObj?.name === 'CastError') {
    res.status(400).json({ message: 'Invalid resource identifier.' });
    return;
  }

  if (errorObj?.name === 'MulterError') {
    const multerMsg =
      errorObj.message === 'File too large'
        ? 'Uploaded file exceeds the 10 MB size limit.'
        : 'File upload failed. Please check the file size and type.';
    res.status(400).json({ message: multerMsg });
    return;
  }

  console.error('[Trackly Error]', err);
  res.status(500).json({
    message: 'An unexpected server error occurred. Please try again.',
  });
}
