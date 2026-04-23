/**
 * @module app
 * @description Express application factory.
 *
 * Separates app configuration from server bootstrap so the app can be
 * imported in tests without binding to a port.
 *
 * @security
 *  - express.json() body parser is scoped to this app instance only.
 *  - All routes return JSON; no HTML rendering surface.
 *  - Helmet-style headers should be added here when the dependency is
 *    introduced (tracked in docs/backend/security.md).
 */

import express from 'express';
import { healthRouter } from './routes/health';
import contractsModuleRouter from './routes/contracts.routes';
import reputationRouter from './routes/reputation.routes';
import { requestIdMiddleware } from './middleware/requestId';
import { notFoundHandler, errorHandler } from './middleware/errorHandlers';

/**
 * Creates and configures the Express application.
 *
 * @returns Configured Express app instance (not yet listening).
 */
export function createApp(): express.Application {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(requestIdMiddleware);

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/api/v1/contracts', contractsModuleRouter);
  app.use('/api/v1/reputation', reputationRouter);

  // ── 404 handler ──────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Global error handler ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
