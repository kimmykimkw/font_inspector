import { Request, Response } from 'express';
import { inspectWebsite, InspectionResult } from '../services/inspectionService';
import { saveInspectionResult, getInspection, getHistory, removeInspection } from '../services/firebaseService';

// Process a single website inspection
export const createInspection = async (req: Request, res: Response) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of URLs to inspect' });
    }

    // For now, we only process one URL at a time for testing
    const url = urls[0];
    
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }

    // Make sure URL has http/https protocol
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    console.log(`Processing inspection request for ${normalizedUrl}`);
    
    try {
      // Call the inspection service
      const result = await inspectWebsite(normalizedUrl);
      
      // Save the results to Firebase
      const savedInspection = await saveInspectionResult(normalizedUrl, result);
      
      return res.status(200).json({
        success: true,
        url: normalizedUrl,
        id: savedInspection.id,
        result
      });
    } catch (inspectionError) {
      console.error('Website inspection failed:', inspectionError);
      return res.status(422).json({
        success: false,
        url: normalizedUrl,
        error: inspectionError instanceof Error ? inspectionError.message : 'Website inspection failed'
      });
    }
  } catch (error) {
    console.error('Inspection request error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Get inspection by ID
export const getInspectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Inspection ID is required' });
    }
    
    const inspection = await getInspection(id);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    
    return res.status(200).json(inspection);
  } catch (error) {
    console.error('Error retrieving inspection:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Get inspection history
export const getInspectionHistory = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const inspections = await getHistory(limit);
    
    return res.status(200).json(inspections);
  } catch (error) {
    console.error('Error retrieving inspection history:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
};

// Delete inspection
export const deleteInspection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Inspection ID is required' });
    }
    
    const deleted = await removeInspection(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Inspection not found or could not be deleted' });
    }
    
    return res.status(200).json({ success: true, message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Error deleting inspection:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}; 