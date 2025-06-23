import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { firestoreDb } from './firebase-client';

interface UserStats {
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  totalInspections: number;
  totalProjects: number;
  inspectionsThisMonth: number;
  projectsThisMonth: number;
  lastInspectionAt?: Date;
  lastProjectAt?: Date;
  joinedAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
}

// Update or create user statistics
export const updateUserStats = async (userId: string, email: string, displayName?: string): Promise<void> => {
  if (!firestoreDb) {
    console.warn('Firestore not initialized - cannot update user stats');
    return;
  }

  try {
    const statsRef = doc(firestoreDb, 'user_stats', userId);
    const statsDoc = await getDoc(statsRef);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (!statsDoc.exists()) {
      // Create new stats document
      const newStats: Omit<UserStats, 'id'> = {
        userId,
        email: email.toLowerCase(),
        displayName: displayName || '',
        totalInspections: 0,
        totalProjects: 0,
        inspectionsThisMonth: 0,
        projectsThisMonth: 0,
        joinedAt: now,
        lastActiveAt: now,
        isActive: true
      };
      
      await setDoc(statsRef, {
        ...newStats,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp()
      });
    } else {
      // Update existing stats
      const currentStats = statsDoc.data() as UserStats;
      
      // Reset monthly counts if it's a new month
      const lastActive = currentStats.lastActiveAt instanceof Date 
        ? currentStats.lastActiveAt 
        : new Date();
      
      const resetMonthlyCounts = lastActive.getMonth() !== currentMonth || 
                                lastActive.getFullYear() !== currentYear;

      const updateData: any = {
        lastActiveAt: serverTimestamp(),
        isActive: true,
        displayName: displayName || currentStats.displayName,
      };

      if (resetMonthlyCounts) {
        updateData.inspectionsThisMonth = 0;
        updateData.projectsThisMonth = 0;
      }

      await updateDoc(statsRef, updateData);
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

// Increment inspection count for user
export const incrementUserInspectionCount = async (userId: string): Promise<void> => {
  if (!firestoreDb) {
    console.warn('Firestore not initialized - cannot increment inspection count');
    return;
  }

  try {
    const statsRef = doc(firestoreDb, 'user_stats', userId);
    await updateDoc(statsRef, {
      totalInspections: increment(1),
      inspectionsThisMonth: increment(1),
      lastInspectionAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error incrementing inspection count:', error);
  }
};

// Increment project count for user
export const incrementUserProjectCount = async (userId: string): Promise<void> => {
  if (!firestoreDb) {
    console.warn('Firestore not initialized - cannot increment project count');
    return;
  }

  try {
    const statsRef = doc(firestoreDb, 'user_stats', userId);
    await updateDoc(statsRef, {
      totalProjects: increment(1),
      projectsThisMonth: increment(1),
      lastProjectAt: serverTimestamp(),
      lastActiveAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error incrementing project count:', error);
  }
}; 