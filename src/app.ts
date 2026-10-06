import express, { Application } from 'express';
import { connectDatabase } from './config/database';
import { IAppConfig, loadConfig } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health.routes';
import reservationRoutes from './routes/reservation.routes';

const app: Application = express();

app.use(express.json());
app.use('/api/v1', healthRoutes);
app.use('/api/v1', reservationRoutes);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  const config: IAppConfig = loadConfig();
  await connectDatabase(config.mongodbUri);
  app.listen(config.port, (): void => {
    process.stdout.write(`CampusHub API listening on port ${config.port}\n`);
  });
};

startServer().catch((err: unknown): void => {
  const message: string = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Failed to start CampusHub API: ${message}\n`);
  process.exitCode = 1;
});

export default app;
