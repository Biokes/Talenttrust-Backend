import express, { Request, Response } from 'express';
import helmet from 'helmet';
import contractsRoutes from './routes/contracts.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middlewares
app.use(helmet());

// Request Parsing Middlewares
app.use(express.json());

// Application Routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'talenttrust-backend' });
});

app.use('/api/v1/contracts', contractsRoutes);

// Global Error Handling
app.use(errorHandler);

// Start server if not running in a test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`TalentTrust API listening on http://localhost:${PORT}`);
  });
}

// Export the app for integration testing
export default app;
