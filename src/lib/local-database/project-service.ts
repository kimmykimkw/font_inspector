import { LocalDatabase } from './database';
import { Project } from '../models/project';
import { v4 as uuidv4 } from 'uuid';

/**
 * LocalProjectService handles CRUD operations for projects in SQLite
 * This service mirrors the functionality of Firebase project operations
 */
export class LocalProjectService {
  private db: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.db = database;
  }

  /**
   * Create a new project in the local database
   * Mirrors the createProject function from Firebase models
   */
  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'inspectionIds'> & { inspectionIds?: string[] }): Promise<Project> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    // Validate required fields
    if (!projectData.userId) {
      throw new Error('userId is required to create a project');
    }

    if (!projectData.name) {
      throw new Error('name is required to create a project');
    }

    const database = this.db.getDatabase();
    const now = Date.now();
    const id = uuidv4();

    try {
      // Check if a project with the same name already exists for this user
      const existingProject = await this.getProjectByName(projectData.name, projectData.userId);
      if (existingProject) {
        console.log(`Project with name "${projectData.name}" already exists for user ${projectData.userId}, returning existing project`);
        return existingProject;
      }

      // Convert data to SQLite format
      const sqliteData = this.convertToSQLiteFormat({
        ...projectData,
        id,
        inspectionIds: projectData.inspectionIds || [],
        createdAt: new Date(now),
        updatedAt: new Date(now)
      });

      // Insert into database
      const stmt = database.prepare(`
        INSERT INTO projects (
          id, name, description, inspection_ids, user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        sqliteData.id,
        sqliteData.name,
        sqliteData.description,
        sqliteData.inspection_ids,
        sqliteData.user_id,
        sqliteData.created_at,
        sqliteData.updated_at
      );

      console.log(`Project created with ID: ${id} for user: ${projectData.userId}`);

      // Return the created project
      return this.convertFromSQLiteFormat(sqliteData);
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Get project by ID with optional user verification
   * Mirrors the getProjectById function from Firebase models
   */
  async getProject(id: string, userId?: string): Promise<Project | null> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare('SELECT * FROM projects WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      const project = this.convertFromSQLiteFormat(row);

      // If userId is provided, verify the project belongs to the user
      if (userId && project.userId !== userId) {
        return null; // User is not authorized to view this project
      }

      return project;
    } catch (error) {
      console.error('Error getting project:', error);
      throw new Error(`Failed to get project: ${error}`);
    }
  }

  /**
   * Get project by name for a specific user
   */
  async getProjectByName(name: string, userId: string): Promise<Project | null> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare('SELECT * FROM projects WHERE name = ? AND user_id = ? LIMIT 1');
      const row = stmt.get(name, userId) as any;

      if (!row) {
        return null;
      }

      return this.convertFromSQLiteFormat(row);
    } catch (error) {
      console.error('Error getting project by name:', error);
      throw new Error(`Failed to get project by name: ${error}`);
    }
  }

  /**
   * Get all projects for a specific user with optional pagination
   * Mirrors the getAllProjects function from Firebase models
   */
  async getProjectsByUser(
    userId: string, 
    options: { 
      limit?: number; 
      offset?: number; 
      orderBy?: 'createdAt' | 'updatedAt' | 'name';
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<Project[]> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const {
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'DESC'
    } = options;

    // Map camelCase to snake_case column names
    const columnMap: Record<string, string> = {
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'name': 'name'
    };

    const sqlColumnName = columnMap[orderBy] || 'created_at';
    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare(`
        SELECT * FROM projects 
        WHERE user_id = ? 
        ORDER BY ${sqlColumnName} ${orderDirection}
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(userId, limit, offset) as any[];

      return rows.map(row => this.convertFromSQLiteFormat(row));
    } catch (error) {
      console.error('Error getting projects by user:', error);
      throw new Error(`Failed to get projects: ${error}`);
    }
  }

  /**
   * Get recent projects for a specific user
   * Mirrors the getRecentProjects function from Firebase models
   */
  async getRecentProjects(userId: string, limit: number = 10): Promise<Project[]> {
    return this.getProjectsByUser(userId, { limit, orderBy: 'createdAt', orderDirection: 'DESC' });
  }

  /**
   * Update an existing project
   */
  async updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project | null> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      // First get the existing project
      const existing = await this.getProject(id);
      if (!existing) {
        return null;
      }

      // Merge updates with existing data
      const updatedProject = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Convert to SQLite format
      const sqliteData = this.convertToSQLiteFormat(updatedProject);

      // Update in database
      const stmt = database.prepare(`
        UPDATE projects SET
          name = ?, description = ?, inspection_ids = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        sqliteData.name,
        sqliteData.description,
        sqliteData.inspection_ids,
        sqliteData.updated_at,
        id
      );

      return this.convertFromSQLiteFormat(sqliteData);
    } catch (error) {
      console.error('Error updating project:', error);
      throw new Error(`Failed to update project: ${error}`);
    }
  }

  /**
   * Add inspection to project
   * Mirrors the addInspectionToProject function from Firebase models
   */
  async addInspectionToProject(projectId: string, inspectionId: string): Promise<boolean> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    try {
      // Get the current project
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Check if inspection is already in the project
      if (project.inspectionIds.includes(inspectionId)) {
        console.log(`Inspection ${inspectionId} already exists in project ${projectId}`);
        return true;
      }

      // Add inspection ID to the project
      const updatedInspectionIds = [...project.inspectionIds, inspectionId];
      
      const updatedProject = await this.updateProject(projectId, {
        inspectionIds: updatedInspectionIds
      });

      if (updatedProject) {
        console.log(`Successfully added inspection ${inspectionId} to project ${projectId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error adding inspection to project:', error);
      return false;
    }
  }

  /**
   * Remove inspection from project
   */
  async removeInspectionFromProject(projectId: string, inspectionId: string): Promise<boolean> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    try {
      // Get the current project
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Remove inspection ID from the project
      const updatedInspectionIds = project.inspectionIds.filter(id => id !== inspectionId);
      
      const updatedProject = await this.updateProject(projectId, {
        inspectionIds: updatedInspectionIds
      });

      if (updatedProject) {
        console.log(`Successfully removed inspection ${inspectionId} from project ${projectId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error removing inspection from project:', error);
      return false;
    }
  }

  /**
   * Delete a project by ID and all associated inspections
   */
  async deleteProject(id: string): Promise<boolean> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      // Use a transaction to ensure both operations succeed or fail together
      const deleteTransaction = database.transaction(() => {
        // First, delete all inspections associated with this project
        const deleteInspectionsStmt = database.prepare('DELETE FROM inspections WHERE project_id = ?');
        const inspectionResult = deleteInspectionsStmt.run(id);
        console.log(`Deleted ${inspectionResult.changes} inspections for project ${id}`);

        // Then, delete the project itself
        const deleteProjectStmt = database.prepare('DELETE FROM projects WHERE id = ?');
        const projectResult = deleteProjectStmt.run(id);
        console.log(`Deleted project ${id}: ${projectResult.changes > 0 ? 'success' : 'not found'}`);

        return projectResult.changes > 0;
      });

      return deleteTransaction();
    } catch (error) {
      console.error('Error deleting project and associated inspections:', error);
      throw new Error(`Failed to delete project: ${error}`);
    }
  }

  /**
   * Search projects by name
   * Mirrors the searchProjects function from Firebase models
   */
  async searchProjects(
    userId: string, 
    searchTerm: string, 
    limit: number = 50
  ): Promise<Project[]> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare(`
        SELECT * FROM projects 
        WHERE user_id = ? AND (
          name LIKE ? OR 
          description LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const searchPattern = `%${searchTerm}%`;
      const rows = stmt.all(userId, searchPattern, searchPattern, limit) as any[];

      return rows.map(row => this.convertFromSQLiteFormat(row));
    } catch (error) {
      console.error('Error searching projects:', error);
      throw new Error(`Failed to search projects: ${error}`);
    }
  }

  /**
   * Get project count for a user
   */
  async getProjectCount(userId: string): Promise<number> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?');
      const result = stmt.get(userId) as { count: number };
      
      return result.count;
    } catch (error) {
      console.error('Error getting project count:', error);
      return 0;
    }
  }

  /**
   * Convert Project object to SQLite format
   */
  private convertToSQLiteFormat(project: Project): any {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      inspection_ids: JSON.stringify(project.inspectionIds || []),
      user_id: project.userId,
      created_at: this.dateToTimestamp(project.createdAt),
      updated_at: this.dateToTimestamp(project.updatedAt)
    };
  }

  /**
   * Convert SQLite row to Project object
   */
  private convertFromSQLiteFormat(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      inspectionIds: JSON.parse(row.inspection_ids || '[]') as string[],
      userId: row.user_id,
      createdAt: this.timestampToDate(row.created_at),
      updatedAt: this.timestampToDate(row.updated_at)
    };
  }

  /**
   * Convert Date or Timestamp to Unix timestamp (milliseconds)
   */
  private dateToTimestamp(date: any): number {
    if (date && typeof date.toMillis === 'function') {
      // Firebase Timestamp
      return date.toMillis();
    } else if (date instanceof Date) {
      return date.getTime();
    } else if (typeof date === 'number') {
      return date;
    }
    return Date.now();
  }

  /**
   * Convert Unix timestamp to Date object
   */
  private timestampToDate(timestamp: number): Date {
    return new Date(timestamp);
  }
}
