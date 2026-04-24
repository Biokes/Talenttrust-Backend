/**
 * @module index
 * @description Server entry and exported Express app.
 *
 * Import `{ app }` in tests. The HTTP server and BullMQ workers start only
 * when this file is the program entry and Jest is not running.
 */

import type { Request, Response } from 'express';
import { validateEnvironment } from './config/environment';
import { createApp } from './app';
import { JobType, JobPayload, QueueManager } from './queue';

// Validate environment at startup
validateEnvironment();

const queueManager = QueueManager.getInstance();

const app = createApp();


app.post('/api/v1/jobs', async (req: Request, res: Response) => {
  try {
    const { type, payload, options } = req.body as {
      type?: string;
      payload?: unknown;
      options?: { priority?: number; delay?: number };
    };

    if (!type || payload === undefined) {
      return res.status(400).json({ error: 'Job type and payload are required' });
    }

    if (!Object.values(JobType).includes(type as JobType)) {
      return res.status(400).json({ error: `Invalid job type: ${type}` });
    }

    const jobId = await queueManager.addJob(type as JobType, payload as JobPayload, options);
    return res.status(201).json({ jobId, type, status: 'queued' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to enqueue job: ${message}` });
  }
});

app.get('/api/v1/jobs/:type/:jobId', async (req: Request, res: Response) => {
  try {
    const { type, jobId } = req.params;

    if (!Object.values(JobType).includes(type as JobType)) {
      return res.status(400).json({ error: `Invalid job type: ${type}` });
    }

    const status = await queueManager.getJobStatus(type as JobType, jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to get job status: ${message}` });
  }
});

export { app };
export default app;

const isMainModule =
  typeof require !== 'undefined' &&
  (require as NodeRequire).main === module;
const isJest = Boolean(process.env.JEST_WORKER_ID);
const shouldBootstrapServer = (isMainModule && !isJest) || process.env.FORCE_START_INDEX === '1';

async function initializeQueues(): Promise<void> {
  if (isJest) {
    return;
  }
  for (const jobType of Object.values(JobType)) {
    await queueManager.initializeQueue(jobType);
  }
}

async function gracefulShutdown(): Promise<void> {
  if (!isJest) {
    await queueManager.shutdown();
  }
  process.exit(0);
}

async function startServer(): Promise<void> {
  const PORT = Number(process.env.PORT) || 3001;
  if (!isJest) {
    await initializeQueues();
  }

  if (!isJest) {
    app.listen(PORT, () => {
      console.log(`TalentTrust API listening on http://localhost:${PORT}`);
    });
  }
}

if (isJest) {
  // Tests import `app` only; do not start listeners or Redis-backed queues here.
} else {
  process.on('SIGTERM', () => {
    void gracefulShutdown();
  });
  process.on('SIGINT', () => {
    void gracefulShutdown();
  });
}

if (shouldBootstrapServer) {
  void startServer();
}
