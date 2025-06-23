import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import inspectionRoutes from './routes/inspectionRoutes';
import projectRoutes from './routes/projectRoutes';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK' });
});

// Use route files
app.use('/api/inspect', inspectionRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/projects', projectRoutes);

// Export the Express API
export default app; 