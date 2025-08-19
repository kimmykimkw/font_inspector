import { LocalDatabase } from './database';
import { 
  Inspection, 
  DownloadedFont, 
  FontFaceDeclaration, 
  ActiveFont, 
  ScreenshotData 
} from '../models/inspection';
import { v4 as uuidv4 } from 'uuid';

/**
 * LocalInspectionService handles CRUD operations for inspections in SQLite
 * This service mirrors the functionality of Firebase inspection operations
 */
export class LocalInspectionService {
  private db: LocalDatabase;

  constructor(database: LocalDatabase) {
    this.db = database;
  }

  /**
   * Create a new inspection in the local database
   * Mirrors the createInspection function from Firebase models
   */
  async createInspection(inspectionData: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Inspection> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    // Validate required fields
    if (!inspectionData.userId) {
      throw new Error('userId is required to create an inspection');
    }

    if (!inspectionData.url) {
      throw new Error('url is required to create an inspection');
    }

    const database = this.db.getDatabase();
    const now = Date.now();
    const id = uuidv4();

    try {
      // Convert data to SQLite format
      const sqliteData = this.convertToSQLiteFormat({
        ...inspectionData,
        id,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      });

      // Insert into database
      const stmt = database.prepare(`
        INSERT INTO inspections (
          id, url, timestamp, downloaded_fonts, font_face_declarations, 
          active_fonts, project_id, user_id, created_at, updated_at, 
          status, error, screenshot_original, screenshot_annotated,
          screenshot_captured_at, screenshot_dimensions, screenshot_annotation_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        sqliteData.id,
        sqliteData.url,
        sqliteData.timestamp,
        sqliteData.downloaded_fonts,
        sqliteData.font_face_declarations,
        sqliteData.active_fonts,
        sqliteData.project_id,
        sqliteData.user_id,
        sqliteData.created_at,
        sqliteData.updated_at,
        sqliteData.status,
        sqliteData.error,
        sqliteData.screenshot_original,
        sqliteData.screenshot_annotated,
        sqliteData.screenshot_captured_at,
        sqliteData.screenshot_dimensions,
        sqliteData.screenshot_annotation_count
      );

      console.log(`Inspection created with ID: ${id} for user: ${inspectionData.userId}`);

      // Return the created inspection
      return this.convertFromSQLiteFormat(sqliteData);
    } catch (error) {
      console.error('Error creating inspection:', error);
      throw new Error(`Failed to create inspection: ${error}`);
    }
  }

  /**
   * Get inspection by ID
   */
  async getInspection(id: string): Promise<Inspection | null> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare('SELECT * FROM inspections WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.convertFromSQLiteFormat(row);
    } catch (error) {
      console.error('Error getting inspection:', error);
      throw new Error(`Failed to get inspection: ${error}`);
    }
  }

  /**
   * Get inspections by user ID with optional pagination
   * Mirrors the getRecentInspections function from Firebase models
   */
  async getInspectionsByUser(
    userId: string, 
    options: { 
      limit?: number; 
      offset?: number; 
      orderBy?: 'createdAt' | 'updatedAt' | 'timestamp';
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<Inspection[]> {
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
      'timestamp': 'timestamp'
    };

    const sqlColumnName = columnMap[orderBy] || 'created_at';
    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare(`
        SELECT * FROM inspections 
        WHERE user_id = ? 
        ORDER BY ${sqlColumnName} ${orderDirection}
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(userId, limit, offset) as any[];

      return rows.map(row => this.convertFromSQLiteFormat(row));
    } catch (error) {
      console.error('Error getting inspections by user:', error);
      throw new Error(`Failed to get inspections: ${error}`);
    }
  }

  /**
   * Get inspections by project ID
   */
  async getInspectionsByProjectId(projectId: string): Promise<Inspection[]> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare(`
        SELECT * FROM inspections 
        WHERE project_id = ? 
        ORDER BY created_at DESC
      `);

      const rows = stmt.all(projectId) as any[];

      return rows.map(row => this.convertFromSQLiteFormat(row));
    } catch (error) {
      console.error('Error getting inspections by project:', error);
      throw new Error(`Failed to get inspections by project: ${error}`);
    }
  }

  /**
   * Update an existing inspection
   */
  async updateInspection(id: string, updates: Partial<Omit<Inspection, 'id' | 'createdAt'>>): Promise<Inspection | null> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      // First get the existing inspection
      const existing = await this.getInspection(id);
      if (!existing) {
        return null;
      }

      // Merge updates with existing data
      const updatedInspection = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Convert to SQLite format
      const sqliteData = this.convertToSQLiteFormat(updatedInspection);

      // Update in database
      const stmt = database.prepare(`
        UPDATE inspections SET
          url = ?, timestamp = ?, downloaded_fonts = ?, font_face_declarations = ?,
          active_fonts = ?, project_id = ?, updated_at = ?, status = ?, error = ?,
          screenshot_original = ?, screenshot_annotated = ?, screenshot_captured_at = ?,
          screenshot_dimensions = ?, screenshot_annotation_count = ?
        WHERE id = ?
      `);

      stmt.run(
        sqliteData.url,
        sqliteData.timestamp,
        sqliteData.downloaded_fonts,
        sqliteData.font_face_declarations,
        sqliteData.active_fonts,
        sqliteData.project_id,
        sqliteData.updated_at,
        sqliteData.status,
        sqliteData.error,
        sqliteData.screenshot_original,
        sqliteData.screenshot_annotated,
        sqliteData.screenshot_captured_at,
        sqliteData.screenshot_dimensions,
        sqliteData.screenshot_annotation_count,
        id
      );

      return this.convertFromSQLiteFormat(sqliteData);
    } catch (error) {
      console.error('Error updating inspection:', error);
      throw new Error(`Failed to update inspection: ${error}`);
    }
  }

  /**
   * Delete an inspection by ID
   */
  async deleteInspection(id: string): Promise<boolean> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare('DELETE FROM inspections WHERE id = ?');
      const result = stmt.run(id);

      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting inspection:', error);
      throw new Error(`Failed to delete inspection: ${error}`);
    }
  }

  /**
   * Search inspections by URL or other criteria
   */
  async searchInspections(
    userId: string, 
    searchTerm: string, 
    limit: number = 50
  ): Promise<Inspection[]> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare(`
        SELECT * FROM inspections 
        WHERE user_id = ? AND (
          url LIKE ? OR 
          downloaded_fonts LIKE ? OR 
          active_fonts LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const searchPattern = `%${searchTerm}%`;
      const rows = stmt.all(userId, searchPattern, searchPattern, searchPattern, limit) as any[];

      return rows.map(row => this.convertFromSQLiteFormat(row));
    } catch (error) {
      console.error('Error searching inspections:', error);
      throw new Error(`Failed to search inspections: ${error}`);
    }
  }

  /**
   * Get inspection count for a user
   */
  async getInspectionCount(userId: string): Promise<number> {
    if (!this.db.isInitialized()) {
      throw new Error('Database not initialized');
    }

    const database = this.db.getDatabase();

    try {
      const stmt = database.prepare('SELECT COUNT(*) as count FROM inspections WHERE user_id = ?');
      const result = stmt.get(userId) as { count: number };
      
      return result.count;
    } catch (error) {
      console.error('Error getting inspection count:', error);
      return 0;
    }
  }

  /**
   * Convert Inspection object to SQLite format
   */
  private convertToSQLiteFormat(inspection: Inspection): any {
    return {
      id: inspection.id,
      url: inspection.url,
      timestamp: this.dateToTimestamp(inspection.timestamp),
      downloaded_fonts: JSON.stringify(inspection.downloadedFonts || []),
      font_face_declarations: JSON.stringify(inspection.fontFaceDeclarations || []),
      active_fonts: JSON.stringify(inspection.activeFonts || []),
      project_id: inspection.projectId || null,
      user_id: inspection.userId,
      created_at: this.dateToTimestamp(inspection.createdAt),
      updated_at: this.dateToTimestamp(inspection.updatedAt),
      status: inspection.status || 'completed',
      error: inspection.error || null,
      screenshot_original: inspection.screenshots?.original || null,
      screenshot_annotated: inspection.screenshots?.annotated || null,
      screenshot_captured_at: inspection.screenshots?.capturedAt ? this.dateToTimestamp(inspection.screenshots.capturedAt) : null,
      screenshot_dimensions: inspection.screenshots?.dimensions ? JSON.stringify(inspection.screenshots.dimensions) : null,
      screenshot_annotation_count: inspection.screenshots?.annotationCount || null
    };
  }

  /**
   * Convert SQLite row to Inspection object
   */
  private convertFromSQLiteFormat(row: any): Inspection {
    const screenshots: ScreenshotData | undefined = row.screenshot_original ? {
      original: row.screenshot_original,
      annotated: row.screenshot_annotated,
      capturedAt: this.timestampToDate(row.screenshot_captured_at),
      dimensions: row.screenshot_dimensions ? JSON.parse(row.screenshot_dimensions) : undefined,
      annotationCount: row.screenshot_annotation_count
    } : undefined;

    return {
      id: row.id,
      url: row.url,
      timestamp: this.timestampToDate(row.timestamp),
      downloadedFonts: JSON.parse(row.downloaded_fonts || '[]') as DownloadedFont[],
      fontFaceDeclarations: JSON.parse(row.font_face_declarations || '[]') as FontFaceDeclaration[],
      activeFonts: JSON.parse(row.active_fonts || '[]') as ActiveFont[],
      projectId: row.project_id,
      userId: row.user_id,
      createdAt: this.timestampToDate(row.created_at),
      updatedAt: this.timestampToDate(row.updated_at),
      status: row.status,
      error: row.error,
      screenshots
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
