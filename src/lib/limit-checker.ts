import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestoreDb } from './firebase-client';

interface UserPermissions {
  canUseApp: boolean;
  maxInspectionsPerMonth: number;
  maxProjectsPerMonth: number;
  suspendedUntil?: Date;
  suspensionReason?: string;
}

interface UserStats {
  inspectionsThisMonth: number;
  projectsThisMonth: number;
}

interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
}

// Default permissions for users who don't have explicit permissions set
const DEFAULT_PERMISSIONS: UserPermissions = {
  canUseApp: true,
  maxInspectionsPerMonth: 50,
  maxProjectsPerMonth: 10
};

// Get user permissions by querying the userId field
const getUserPermissions = async (userId: string, userEmail: string): Promise<UserPermissions | null> => {
  if (!firestoreDb) {
    return null;
  }

  try {
    // Query user permissions by userId field (can be either email or userId)
    const permissionsRef = collection(firestoreDb, 'user_permissions');
    const q = query(permissionsRef, where('userId', 'in', [userEmail, userId]));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Get the first matching permission document
    const permissionDoc = querySnapshot.docs[0];
    return permissionDoc.data() as UserPermissions;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return null;
  }
};

// Check if user can create an inspection
export const checkInspectionLimit = async (userId: string, userEmail: string): Promise<LimitCheckResult> => {
  if (!firestoreDb) {
    return { allowed: false, reason: 'Database not available' };
  }

  try {
    // Get user permissions
    const permissions = await getUserPermissions(userId, userEmail);
    
    // If no permissions found, use default permissions
    const userPermissions = permissions || DEFAULT_PERMISSIONS;

    // Check if user can use the app
    if (!userPermissions.canUseApp) {
      return { allowed: false, reason: 'Your account access has been restricted. Please contact an administrator.' };
    }

    // Check if user is currently suspended
    if (userPermissions.suspendedUntil) {
      const suspensionEnd = userPermissions.suspendedUntil instanceof Date 
        ? userPermissions.suspendedUntil 
        : new Date(userPermissions.suspendedUntil);
      
      if (suspensionEnd > new Date()) {
        return { 
          allowed: false, 
          reason: `Your account is suspended until ${suspensionEnd.toLocaleDateString()}. Reason: ${userPermissions.suspensionReason || 'No reason provided'}` 
        };
      }
    }

    // Get user stats
    const statsRef = doc(firestoreDb, 'user_stats', userId);
    const statsDoc = await getDoc(statsRef);

    if (!statsDoc.exists()) {
      // If no stats exist, user is within limits
      return { allowed: true, currentCount: 0, limit: userPermissions.maxInspectionsPerMonth };
    }

    const stats = statsDoc.data() as UserStats;
    const currentCount = stats.inspectionsThisMonth || 0;

    // Check if user has exceeded their monthly limit
    if (currentCount >= userPermissions.maxInspectionsPerMonth) {
      return {
        allowed: false,
        reason: `Monthly inspection limit reached. You have used ${currentCount} of ${userPermissions.maxInspectionsPerMonth} inspections this month.`,
        currentCount,
        limit: userPermissions.maxInspectionsPerMonth
      };
    }

    return { 
      allowed: true, 
      currentCount, 
      limit: userPermissions.maxInspectionsPerMonth 
    };

  } catch (error) {
    console.error('Error checking inspection limit:', error);
    return { allowed: false, reason: 'Error checking limits. Please try again.' };
  }
};

// Check if user can create a project
export const checkProjectLimit = async (userId: string, userEmail: string): Promise<LimitCheckResult> => {
  if (!firestoreDb) {
    return { allowed: false, reason: 'Database not available' };
  }

  try {
    // Get user permissions
    const permissions = await getUserPermissions(userId, userEmail);
    
    // If no permissions found, use default permissions
    const userPermissions = permissions || DEFAULT_PERMISSIONS;

    // Check if user can use the app
    if (!userPermissions.canUseApp) {
      return { allowed: false, reason: 'Your account access has been restricted. Please contact an administrator.' };
    }

    // Check if user is currently suspended
    if (userPermissions.suspendedUntil) {
      const suspensionEnd = userPermissions.suspendedUntil instanceof Date 
        ? userPermissions.suspendedUntil 
        : new Date(userPermissions.suspendedUntil);
      
      if (suspensionEnd > new Date()) {
        return { 
          allowed: false, 
          reason: `Your account is suspended until ${suspensionEnd.toLocaleDateString()}. Reason: ${userPermissions.suspensionReason || 'No reason provided'}` 
        };
      }
    }

    // Get user stats
    const statsRef = doc(firestoreDb, 'user_stats', userId);
    const statsDoc = await getDoc(statsRef);

    if (!statsDoc.exists()) {
      // If no stats exist, user is within limits
      return { allowed: true, currentCount: 0, limit: userPermissions.maxProjectsPerMonth };
    }

    const stats = statsDoc.data() as UserStats;
    const currentCount = stats.projectsThisMonth || 0;

    // Check if user has exceeded their monthly limit
    if (currentCount >= userPermissions.maxProjectsPerMonth) {
      return {
        allowed: false,
        reason: `Monthly project limit reached. You have used ${currentCount} of ${userPermissions.maxProjectsPerMonth} projects this month.`,
        currentCount,
        limit: userPermissions.maxProjectsPerMonth
      };
    }

    return { 
      allowed: true, 
      currentCount, 
      limit: userPermissions.maxProjectsPerMonth 
    };

  } catch (error) {
    console.error('Error checking project limit:', error);
    return { allowed: false, reason: 'Error checking limits. Please try again.' };
  }
}; 