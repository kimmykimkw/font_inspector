import { db, collections } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';

// System settings interface
export interface SystemSettings {
  id?: string;
  defaultMaxInspectionsPerMonth: number;
  defaultMaxProjectsPerMonth: number;
  updatedAt: Timestamp | Date;
  updatedBy: string; // Admin user ID who updated the settings
}

// Default fallback values (same as current hardcoded values)
const FALLBACK_SETTINGS: Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedBy'> = {
  defaultMaxInspectionsPerMonth: 1000,
  defaultMaxProjectsPerMonth: 300
};

// Cache for settings to avoid repeated database calls
let settingsCache: SystemSettings | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get system settings with caching
export const getSystemSettings = async (): Promise<SystemSettings> => {
  // Check cache first
  if (settingsCache && Date.now() < cacheExpiry) {
    return settingsCache;
  }

  try {
    // Get settings from database
    const settingsDoc = await collections.system_settings.doc('default_limits').get();
    
    if (settingsDoc.exists) {
      const settings = { id: settingsDoc.id, ...settingsDoc.data() } as SystemSettings;
      
      // Update cache
      settingsCache = settings;
      cacheExpiry = Date.now() + CACHE_DURATION;
      
      return settings;
    } else {
      // If no settings exist, create default settings
      const defaultSettings = await createDefaultSettings();
      return defaultSettings;
    }
  } catch (error) {
    console.error('Error fetching system settings:', error);
    // Return fallback settings if database fails
    return {
      ...FALLBACK_SETTINGS,
      updatedAt: new Date(),
      updatedBy: 'system'
    };
  }
};

// Create default settings in database
const createDefaultSettings = async (): Promise<SystemSettings> => {
  try {
    const defaultSettings: Omit<SystemSettings, 'id'> = {
      ...FALLBACK_SETTINGS,
      updatedAt: Timestamp.now(),
      updatedBy: 'system'
    };

    await collections.system_settings.doc('default_limits').set(defaultSettings);
    
    const settings = { id: 'default_limits', ...defaultSettings };
    
    // Update cache
    settingsCache = settings;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    return settings;
  } catch (error) {
    console.error('Error creating default settings:', error);
    throw error;
  }
};

// Update system settings
export const updateSystemSettings = async (
  settings: Pick<SystemSettings, 'defaultMaxInspectionsPerMonth' | 'defaultMaxProjectsPerMonth'>,
  adminUserId: string
): Promise<SystemSettings> => {
  try {
    // Validate settings
    if (settings.defaultMaxInspectionsPerMonth < 1 || settings.defaultMaxInspectionsPerMonth > 10000) {
      throw new Error('Default inspections per month must be between 1 and 10,000');
    }
    
    if (settings.defaultMaxProjectsPerMonth < 1 || settings.defaultMaxProjectsPerMonth > 1000) {
      throw new Error('Default projects per month must be between 1 and 1,000');
    }

    const updatedSettings: Omit<SystemSettings, 'id'> = {
      defaultMaxInspectionsPerMonth: settings.defaultMaxInspectionsPerMonth,
      defaultMaxProjectsPerMonth: settings.defaultMaxProjectsPerMonth,
      updatedAt: Timestamp.now(),
      updatedBy: adminUserId
    };

    await collections.system_settings.doc('default_limits').set(updatedSettings);
    
    const result = { id: 'default_limits', ...updatedSettings };
    
    // Clear cache to force refresh
    settingsCache = null;
    cacheExpiry = 0;
    
    console.log(`System settings updated by admin ${adminUserId}:`, settings);
    
    return result;
  } catch (error) {
    console.error('Error updating system settings:', error);
    throw error;
  }
};

// Clear settings cache (useful for testing or manual refresh)
export const clearSettingsCache = (): void => {
  settingsCache = null;
  cacheExpiry = 0;
};

// Get default user permissions based on current settings
export const getDefaultUserPermissions = async (forceFresh: boolean = false) => {
  // Clear cache if forced refresh is requested (useful for critical operations like user approval)
  if (forceFresh) {
    clearSettingsCache();
  }
  
  const settings = await getSystemSettings();
  
  return {
    canUseApp: true,
    maxInspectionsPerMonth: settings.defaultMaxInspectionsPerMonth,
    maxProjectsPerMonth: settings.defaultMaxProjectsPerMonth
  };
}; 