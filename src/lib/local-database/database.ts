import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

/**
 * LocalDatabase class manages SQLite database connections for individual users
 * Each user gets their own database file for complete data isolation
 */
export class LocalDatabase {
  private db: Database.Database | null = null;
  private userId: string;
  private dbPath: string;

  constructor(userId: string) {
    this.userId = userId;
    this.dbPath = this.getDatabasePath(userId);
  }

  /**
   * Initialize the database connection and create tables if they don't exist
   */
  async initialize(): Promise<void> {
    try {
      // Ensure the database directory exists
      await fs.ensureDir(path.dirname(this.dbPath));
      
      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Enable foreign keys and WAL mode for better performance
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      
      // Create tables using schema
      await this.createTables();
      
      console.log(`Local database initialized for user ${this.userId} at ${this.dbPath}`);
    } catch (error) {
      console.error('Error initializing local database:', error);
      throw new Error(`Failed to initialize database for user ${this.userId}: ${error}`);
    }
  }

  /**
   * Get the database file path for a specific user
   */
  private getDatabasePath(userId: string): string {
    try {
      // Try to get Electron app userData path
      const { app } = require('electron');
      if (app && typeof app.getPath === 'function') {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'databases', `${userId}.db`);
      }
    } catch (error) {
      // Electron not available, use fallback
      console.warn('Electron app not available, using fallback database path');
    }
    
    // Fallback to temp directory for non-Electron environments (testing)
    const os = require('os');
    return path.join(os.tmpdir(), 'font-inspector-databases', `${userId}.db`);
  }

  /**
   * Create database tables using the schema file
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Read schema file
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const schemaPath = path.join(__dirname, 'schema.sql');
      
      let schemaSQL: string;
      try {
        schemaSQL = await fs.readFile(schemaPath, 'utf8');
      } catch (error) {
        // Fallback: define schema inline if file not found
        console.warn('Schema file not found, using inline schema');
        schemaSQL = this.getInlineSchema();
      }

      // Execute schema SQL
      this.db.exec(schemaSQL);
      
      console.log(`Database tables created successfully for user ${this.userId}`);
    } catch (error) {
      console.error('Error creating database tables:', error);
      throw new Error(`Failed to create tables: ${error}`);
    }
  }

  /**
   * Inline schema as fallback if schema.sql file is not found
   */
  private getInlineSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS inspections (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        downloaded_fonts TEXT NOT NULL DEFAULT '[]',
        font_face_declarations TEXT NOT NULL DEFAULT '[]',
        active_fonts TEXT NOT NULL DEFAULT '[]',
        project_id TEXT,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT DEFAULT 'completed',
        error TEXT,
        screenshot_original TEXT,
        screenshot_annotated TEXT,
        screenshot_captured_at INTEGER,
        screenshot_dimensions TEXT,
        screenshot_annotation_count INTEGER
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        inspection_ids TEXT NOT NULL DEFAULT '[]',
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON inspections(user_id);
      CREATE INDEX IF NOT EXISTS idx_inspections_user_created ON inspections(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);
    `;
  }

  /**
   * Get the database instance
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Get user ID associated with this database
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get database file path
   */
  getDatabaseFilePath(): string {
    return this.dbPath;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log(`Database connection closed for user ${this.userId}`);
    }
  }

  /**
   * Get database statistics
   */
  getStats(): { inspectionCount: number; projectCount: number; dbSize: string } {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const inspectionCount = this.db.prepare('SELECT COUNT(*) as count FROM inspections WHERE user_id = ?').get(this.userId) as { count: number };
      const projectCount = this.db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(this.userId) as { count: number };
      
      // Get database file size
      let dbSize = '0 KB';
      try {
        const stats = fs.statSync(this.dbPath);
        const sizeInKB = Math.round(stats.size / 1024);
        dbSize = `${sizeInKB} KB`;
      } catch (error) {
        console.warn('Could not get database file size:', error);
      }

      return {
        inspectionCount: inspectionCount.count,
        projectCount: projectCount.count,
        dbSize
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return { inspectionCount: 0, projectCount: 0, dbSize: '0 KB' };
    }
  }

  /**
   * Vacuum database to optimize performance and reclaim space
   */
  vacuum(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      this.db.exec('VACUUM');
      console.log(`Database vacuumed for user ${this.userId}`);
    } catch (error) {
      console.error('Error vacuuming database:', error);
      throw new Error(`Failed to vacuum database: ${error}`);
    }
  }
}
