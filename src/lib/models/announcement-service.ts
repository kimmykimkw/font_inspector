import { db, collections } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Announcement interface
export interface Announcement {
  id?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isActive: boolean;
  priority: number; // Higher number = higher priority
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string; // Admin user ID who created the announcement
  updatedBy: string; // Admin user ID who last updated the announcement
  expiresAt?: Timestamp | Date; // Optional expiration date
}

// Cache for announcements to avoid repeated database calls
let announcementCache: Announcement[] | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (shorter for announcements)

// Get active announcements with caching
export const getActiveAnnouncements = async (): Promise<Announcement[]> => {
  // Check cache first
  if (announcementCache && Date.now() < cacheExpiry) {
    return announcementCache;
  }

  try {
    const now = Timestamp.now();
    
    // Simple query to avoid index issues
    const snapshot = await collections.announcements
      .where('isActive', '==', true)
      .get();
    
    const announcements: Announcement[] = [];
    snapshot.forEach(doc => {
      const data = doc.data() as Omit<Announcement, 'id'>;
      
      // Check if announcement has expired
      if (data.expiresAt) {
        const expiresAt = data.expiresAt as Timestamp;
        if (expiresAt.toMillis() <= now.toMillis()) {
          return; // Skip expired announcements
        }
      }
      
      announcements.push({
        id: doc.id,
        ...data
      });
    });
    
    // Sort in memory to avoid index requirements
    announcements.sort((a, b) => {
      // Sort by priority first (desc), then by createdAt (desc)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    // Limit to 10 announcements
    const limitedAnnouncements = announcements.slice(0, 10);
    
    // Update cache
    announcementCache = limitedAnnouncements;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    return limitedAnnouncements;
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    return []; // Return empty array on error
  }
};

// Get all announcements (for admin interface)
export const getAllAnnouncements = async (): Promise<Announcement[]> => {
  try {
    // Simple query without complex ordering to avoid index issues
    const snapshot = await collections.announcements.get();
    
    const announcements: Announcement[] = [];
    snapshot.forEach(doc => {
      announcements.push({
        id: doc.id,
        ...doc.data()
      } as Announcement);
    });
    
    // Sort in memory to avoid index requirements
    announcements.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    
    return announcements;
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    // Return empty array instead of throwing to prevent blocking admin interface
    return [];
  }
};

// Create new announcement
export const createAnnouncement = async (
  announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  adminUserId: string
): Promise<Announcement> => {
  try {
    // Validate announcement data
    if (!announcement.title.trim()) {
      throw new Error('Announcement title is required');
    }
    if (!announcement.message.trim()) {
      throw new Error('Announcement message is required');
    }
    if (announcement.priority < 0 || announcement.priority > 100) {
      throw new Error('Priority must be between 0 and 100');
    }

    const now = Timestamp.now();
    const announcementData: Omit<Announcement, 'id'> = {
      ...announcement,
      title: announcement.title.trim(),
      message: announcement.message.trim(),
      createdAt: now,
      updatedAt: now,
      createdBy: adminUserId,
      updatedBy: adminUserId
    };

    const docRef = await collections.announcements.add(announcementData);
    
    const result = { id: docRef.id, ...announcementData };
    
    // Clear cache to force refresh
    clearAnnouncementCache();
    
    console.log(`Announcement created by admin ${adminUserId}:`, result.title);
    
    return result;
  } catch (error) {
    console.error('Error creating announcement:', error);
    throw error;
  }
};

// Update announcement
export const updateAnnouncement = async (
  id: string,
  updates: Partial<Omit<Announcement, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>>,
  adminUserId: string
): Promise<Announcement> => {
  try {
    // Validate updates
    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error('Announcement title cannot be empty');
    }
    if (updates.message !== undefined && !updates.message.trim()) {
      throw new Error('Announcement message cannot be empty');
    }
    if (updates.priority !== undefined && (updates.priority < 0 || updates.priority > 100)) {
      throw new Error('Priority must be between 0 and 100');
    }

    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: adminUserId
    };

    // Trim text fields if they exist
    if (updateData.title) {
      updateData.title = updateData.title.trim();
    }
    if (updateData.message) {
      updateData.message = updateData.message.trim();
    }

    await collections.announcements.doc(id).update(updateData);
    
    // Get updated document
    const updatedDoc = await collections.announcements.doc(id).get();
    if (!updatedDoc.exists) {
      throw new Error('Announcement not found after update');
    }
    
    const result = { id: updatedDoc.id, ...updatedDoc.data() } as Announcement;
    
    // Clear cache to force refresh
    clearAnnouncementCache();
    
    console.log(`Announcement updated by admin ${adminUserId}:`, id);
    
    return result;
  } catch (error) {
    console.error('Error updating announcement:', error);
    throw error;
  }
};

// Delete announcement
export const deleteAnnouncement = async (id: string, adminUserId: string): Promise<void> => {
  try {
    await collections.announcements.doc(id).delete();
    
    // Clear cache to force refresh
    clearAnnouncementCache();
    
    console.log(`Announcement deleted by admin ${adminUserId}:`, id);
  } catch (error) {
    console.error('Error deleting announcement:', error);
    throw error;
  }
};

// Toggle announcement active status
export const toggleAnnouncementStatus = async (
  id: string,
  isActive: boolean,
  adminUserId: string
): Promise<Announcement> => {
  return updateAnnouncement(id, { isActive }, adminUserId);
};

// Clear announcement cache (useful for testing or manual refresh)
export const clearAnnouncementCache = (): void => {
  announcementCache = null;
  cacheExpiry = 0;
};

// Get single announcement by ID
export const getAnnouncementById = async (id: string): Promise<Announcement | null> => {
  try {
    const doc = await collections.announcements.doc(id).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return { id: doc.id, ...doc.data() } as Announcement;
  } catch (error) {
    console.error('Error fetching announcement by ID:', error);
    throw error;
  }
};
