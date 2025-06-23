import express, { RequestHandler } from 'express';
import { createInspection, getInspectionById, getInspectionHistory, deleteInspection } from '../controllers/inspectionController';

const router = express.Router();

// Inspection routes
router.post('/', createInspection as RequestHandler);
router.get('/:id', getInspectionById as RequestHandler);
router.get('/', getInspectionHistory as RequestHandler);
router.delete('/:id', deleteInspection as RequestHandler);

export default router; 