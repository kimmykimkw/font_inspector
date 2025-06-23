/**
 * Utility functions for maintaining the relationship between projects and inspections
 */

/**
 * Add an inspection to a project, ensuring the bidirectional relationship
 * @param {Object} mongoose - Mongoose instance
 * @param {string} projectId - ID of the project
 * @param {string} inspectionId - ID of the inspection
 * @returns {Promise<void>}
 */
async function addInspectionToProject(mongoose, projectId, inspectionId) {
  try {
    const Project = mongoose.models.Project;
    const Inspection = mongoose.models.Inspection;
    
    // Validate inputs
    if (!projectId || !inspectionId) {
      console.error('addInspectionToProject: Missing required parameters');
      return;
    }
    
    console.log(`Adding inspection ${inspectionId} to project ${projectId}`);
    
    // 1. Add inspectionId to project's inspections array if not already there
    await Project.updateOne(
      { _id: projectId, inspections: { $ne: inspectionId } },
      { 
        $addToSet: { inspections: inspectionId },
        $currentDate: { updatedAt: true }
      }
    );
    
    // 2. Ensure inspection has the projectId reference
    await Inspection.updateOne(
      { _id: inspectionId },
      { 
        $set: { projectId: projectId },
        $currentDate: { updatedAt: true } 
      }
    );
    
    console.log(`Successfully linked inspection ${inspectionId} to project ${projectId}`);
  } catch (error) {
    console.error('Error in addInspectionToProject:', error);
    throw error;
  }
}

/**
 * Remove an inspection from a project, maintaining the bidirectional relationship
 * @param {Object} mongoose - Mongoose instance
 * @param {string} projectId - ID of the project
 * @param {string} inspectionId - ID of the inspection
 * @returns {Promise<void>}
 */
async function removeInspectionFromProject(mongoose, projectId, inspectionId) {
  try {
    const Project = mongoose.models.Project;
    const Inspection = mongoose.models.Inspection;
    
    // Validate inputs
    if (!projectId || !inspectionId) {
      console.error('removeInspectionFromProject: Missing required parameters');
      return;
    }
    
    console.log(`Removing inspection ${inspectionId} from project ${projectId}`);
    
    // 1. Remove inspectionId from project's inspections array
    await Project.updateOne(
      { _id: projectId },
      { 
        $pull: { inspections: inspectionId },
        $currentDate: { updatedAt: true }
      }
    );
    
    // 2. Remove projectId from inspection
    await Inspection.updateOne(
      { _id: inspectionId, projectId: projectId },
      { 
        $unset: { projectId: "" },
        $currentDate: { updatedAt: true } 
      }
    );
    
    console.log(`Successfully unlinked inspection ${inspectionId} from project ${projectId}`);
  } catch (error) {
    console.error('Error in removeInspectionFromProject:', error);
    throw error;
  }
}

module.exports = {
  addInspectionToProject,
  removeInspectionFromProject
}; 