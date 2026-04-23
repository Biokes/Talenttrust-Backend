import { sanitizeErrorMessage, safeMessageForCode } from './safeErrors';

export interface ErrorPayload {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

/**
 * Application-level error with explicit status and machine-readable code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly expose: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'unauthorized', message);
  }
}

/**
 * Normalizes thrown errors into a safe and consistent API response payload.
 */
export function mapErrorToPayload(
  error: unknown,
  requestId: string,
): { statusCode: number; payload: ErrorPayload } {
  if (error instanceof AppError) {
    const message = error.expose
      ? sanitizeErrorMessage(error.message, error.code)
      : safeMessageForCode(error.code);

    return {
      statusCode: error.statusCode,
      payload: {
        error: {
          code: error.code,
          message,
          requestId,
        },
      },
    };
  }

  return {
    statusCode: 500,
    payload: {
      error: {
        code: 'internal_error',
        message: safeMessageForCode('internal_error'),
        requestId,
      },
    },
  };
}
