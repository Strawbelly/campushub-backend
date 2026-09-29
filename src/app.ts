import express, { Application } from 'express';
import healthRoutes from './routes/health.routes';
import reservationRoutes from './routes/reservation.routes';

const app: Application = express();
const PORT: number = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use('/api/v1', healthRoutes);
app.use('/api/v1', reservationRoutes);

app.listen(PORT, (): void => {
  process.stdout.write(`CampusHub API listening on port ${PORT}\n`);
});

export default app;
