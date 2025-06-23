import express, { RequestHandler } from 'express';
import { createNewProject, getProjectById, getAllProjects, deleteProject } from '../controllers/projectController';

const router = express.Router();

// Project routes
router.post('/', createNewProject as RequestHandler);
router.get('/:id', getProjectById as RequestHandler);
router.get('/', getAllProjects as RequestHandler);
router.delete('/:id', deleteProject as RequestHandler);

export default router; 