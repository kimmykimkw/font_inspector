import { LocalDatabase } from './local-database/database';
import { LocalInspectionService } from './local-database/inspection-service';
import { LocalProjectService } from './local-database/project-service';

/**
 * DatabaseFactory manages user-specific database instances
 * Each user gets their own SQLite database for complete data isolation
 */
export class DatabaseFactory {
  // Map to store database instances per user
  private static instances = new Map<string, DatabaseInstance>();
  
  // Track initialization promises to prevent race conditions
  private static initializationPromises = new Map<string, Promise<DatabaseInstance>>();

  /**
   * Get database services for a specific user
   * Creates and initializes the database if it doesn't exist
   */
  static async getServices(userId: string): Promise<DatabaseInstance> {
    if (!userId) {
      throw new Error('userId is required to get database services');
    }

    // Return existing instance if available
    if (this.instances.has(userId)) {
      const instance = this.instances.get(userId)!;
      if (instance.db.isInitialized()) {
        return instance;
      }
    }

    // Check if initialization is in progress
    if (this.initializationPromises.has(userId)) {
      return await this.initializationPromises.get(userId)!;
    }

    // Start initialization
    const initPromise = this.initializeDatabase(userId);
    this.initializationPromises.set(userId, initPromise);

    try {
      const instance = await initPromise;
      this.instances.set(userId, instance);
      return instance;
    } finally {
      // Clean up the initialization promise
      this.initializationPromises.delete(userId);
    }
  }

  /**
   * Initialize database and services for a user
   */
  private static async initializeDatabase(userId: string): Promise<DatabaseInstance> {
    try {
      console.log(`Initializing database for user: ${userId}`);
      
      // Create database instance
      const db = new LocalDatabase(userId);
      await db.initialize();

      // Create service instances
      const inspections = new LocalInspectionService(db);
      const projects = new LocalProjectService(db);

      const instance: DatabaseInstance = {
        db,
        inspections,
        projects,
        userId,
        createdAt: new Date()
      };

      console.log(`Database services initialized successfully for user: ${userId}`);
      return instance;
    } catch (error) {
      console.error(`Failed to initialize database for user ${userId}:`, error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /**
   * Check if services are available for a user
   */
  static hasServices(userId: string): boolean {
    return this.instances.has(userId) && this.instances.get(userId)!.db.isInitialized();
  }

  /**
   * Get database statistics for a user
   */
  static async getStats(userId: string): Promise<DatabaseStats | null> {
    if (!this.hasServices(userId)) {
      return null;
    }

    try {
      const instance = this.instances.get(userId)!;
      const dbStats = instance.db.getStats();
      
      return {
        userId,
        inspectionCount: dbStats.inspectionCount,
        projectCount: dbStats.projectCount,
        databaseSize: dbStats.dbSize,
        databasePath: instance.db.getDatabaseFilePath(),
        createdAt: instance.createdAt,
        lastAccessed: new Date()
      };
    } catch (error) {
      console.error(`Error getting stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Close database connection for a user
   */
  static closeDatabase(userId: string): boolean {
    if (this.instances.has(userId)) {
      const instance = this.instances.get(userId)!;
      instance.db.close();
      this.instances.delete(userId);
      console.log(`Database closed for user: ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * Close all database connections
   * Useful for application shutdown
   */
  static closeAllDatabases(): void {
    console.log(`Closing ${this.instances.size} database connections`);
    
    for (const [userId, instance] of this.instances) {
      try {
        instance.db.close();
        console.log(`Closed database for user: ${userId}`);
      } catch (error) {
        console.error(`Error closing database for user ${userId}:`, error);
      }
    }

    this.instances.clear();
    this.initializationPromises.clear();
  }

  /**
   * Get list of active database users
   */
  static getActiveUsers(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Vacuum database for a specific user
   * Optimizes database performance and reclaims space
   */
  static async vacuumDatabase(userId: string): Promise<boolean> {
    if (!this.hasServices(userId)) {
      return false;
    }

    try {
      const instance = this.instances.get(userId)!;
      instance.db.vacuum();
      console.log(`Database vacuumed for user: ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error vacuuming database for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Vacuum all active databases
   */
  static async vacuumAllDatabases(): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const userId of this.getActiveUsers()) {
      try {
        const vacuumResult = await this.vacuumDatabase(userId);
        if (vacuumResult) {
          success.push(userId);
        } else {
          failed.push(userId);
        }
      } catch (error) {
        console.error(`Failed to vacuum database for user ${userId}:`, error);
        failed.push(userId);
      }
    }

    return { success, failed };
  }

  /**
   * Get memory usage statistics
   */
  static getMemoryStats(): MemoryStats {
    const activeConnections = this.instances.size;
    const pendingInitializations = this.initializationPromises.size;
    
    return {
      activeConnections,
      pendingInitializations,
      totalUsers: activeConnections + pendingInitializations
    };
  }
}

/**
 * Interface for database instance
 */
export interface DatabaseInstance {
  db: LocalDatabase;
  inspections: LocalInspectionService;
  projects: LocalProjectService;
  userId: string;
  createdAt: Date;
}

/**
 * Interface for database statistics
 */
export interface DatabaseStats {
  userId: string;
  inspectionCount: number;
  projectCount: number;
  databaseSize: string;
  databasePath: string;
  createdAt: Date;
  lastAccessed: Date;
}

/**
 * Interface for memory usage statistics
 */
export interface MemoryStats {
  activeConnections: number;
  pendingInitializations: number;
  totalUsers: number;
}

// Export singleton instance
export const databaseFactory = DatabaseFactory;
