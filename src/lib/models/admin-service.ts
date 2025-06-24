import { db, collections } from '../firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { 
  UserInvitation, 
  AdminUser, 
  UserPermissions, 
  UserStats, 
  InvitationRequest,
  AdminPermissions 
} from './admin';

// ===== USER INVITATION FUNCTIONS =====

// Convert Firestore document to UserInvitation object
export const convertUserInvitation = (doc: FirebaseFirestore.DocumentSnapshot): UserInvitation | null => {
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return { id: doc.id, ...data } as UserInvitation;
};

// Create a new user invitation request
export const createUserInvitation = async (request: InvitationRequest): Promise<UserInvitation> => {
  // Check if invitation already exists for this email
  const existingQuery = await collections.user_invitations
    .where('email', '==', request.email.toLowerCase())
    .where('status', 'in', ['pending', 'approved'])
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    const existing = convertUserInvitation(existingQuery.docs[0]);
    if (existing?.status === 'approved') {
      throw new Error('User with this email already has access to the application');
    }
    if (existing?.status === 'pending') {
      throw new Error('An invitation request for this email is already pending review');
    }
  }

  const invitation: Omit<UserInvitation, 'id'> = {
    name: request.name.trim(),
    email: request.email.toLowerCase().trim(),
    status: 'pending',
    requestedAt: Timestamp.now()
  };

  const docRef = await collections.user_invitations.add(invitation);
  const doc = await docRef.get();
  return convertUserInvitation(doc) as UserInvitation;
};

// Get all pending invitations
export const getPendingInvitations = async (): Promise<UserInvitation[]> => {
  const snapshot = await collections.user_invitations
    .where('status', '==', 'pending')
    .orderBy('requestedAt', 'desc')
    .get();

  return snapshot.docs
    .map(convertUserInvitation)
    .filter((invitation): invitation is UserInvitation => invitation !== null);
};

// Get all invitations with pagination
export const getAllInvitations = async (
  limit = 50, 
  status?: 'pending' | 'approved' | 'rejected'
): Promise<UserInvitation[]> => {
  let query: FirebaseFirestore.Query = collections.user_invitations;

  if (status) {
    query = query.where('status', '==', status);
  }

  const snapshot = await query
    .orderBy('requestedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs
    .map(convertUserInvitation)
    .filter((invitation): invitation is UserInvitation => invitation !== null);
};

// Approve user invitation
export const approveUserInvitation = async (
  invitationId: string, 
  adminUserId: string,
  approvalNotes?: string
): Promise<boolean> => {
  try {
    await db.runTransaction(async (transaction) => {
      const invitationRef = collections.user_invitations.doc(invitationId);
      const invitationDoc = await transaction.get(invitationRef);

      if (!invitationDoc.exists) {
        throw new Error('Invitation not found');
      }

      const invitation = convertUserInvitation(invitationDoc);
      if (!invitation) {
        throw new Error('Invalid invitation data');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation has already been reviewed');
      }

      // Update invitation status
      transaction.update(invitationRef, {
        status: 'approved',
        reviewedAt: Timestamp.now(),
        reviewedBy: adminUserId,
        approvalNotes: approvalNotes || ''
      });

      // Create user permissions with default settings
      const userPermissionsRef = collections.user_permissions.doc();
      transaction.set(userPermissionsRef, {
        userId: invitation.email, // We'll update this when user actually signs up
        canUseApp: true,
        maxInspectionsPerMonth: 1000, // Default limit
        maxProjectsPerMonth: 300, // Default limit
        updatedAt: Timestamp.now(),
        updatedBy: adminUserId
      });
    });

    return true;
  } catch (error) {
    console.error('Error approving user invitation:', error);
    return false;
  }
};

// Reject user invitation
export const rejectUserInvitation = async (
  invitationId: string, 
  adminUserId: string,
  rejectionReason: string
): Promise<boolean> => {
  try {
    const invitationRef = collections.user_invitations.doc(invitationId);
    await invitationRef.update({
      status: 'rejected',
      reviewedAt: Timestamp.now(),
      reviewedBy: adminUserId,
      rejectionReason: rejectionReason
    });

    return true;
  } catch (error) {
    console.error('Error rejecting user invitation:', error);
    return false;
  }
};

// ===== USER MANAGEMENT FUNCTIONS =====

// Check if user is authorized to use the app
export const isUserAuthorized = async (email: string): Promise<boolean> => {
  try {
    // Check if user has approved invitation
    const invitationQuery = await collections.user_invitations
      .where('email', '==', email.toLowerCase())
      .where('status', '==', 'approved')
      .limit(1)
      .get();

    if (invitationQuery.empty) {
      return false;
    }

    // Check user permissions
    const permissionsQuery = await collections.user_permissions
      .where('userId', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (permissionsQuery.empty) {
      return false;
    }

    const permissions = permissionsQuery.docs[0].data() as UserPermissions;
    
    // Check if user is suspended
    if (permissions.suspendedUntil) {
      const suspendedUntil = permissions.suspendedUntil instanceof Timestamp 
        ? permissions.suspendedUntil.toDate() 
        : new Date(permissions.suspendedUntil);
      
      if (suspendedUntil > new Date()) {
        return false; // Still suspended
      }
    }

    return permissions.canUseApp;
  } catch (error) {
    console.error('Error checking user authorization:', error);
    return false;
  }
};

// ===== USER STATISTICS FUNCTIONS =====

// Update user statistics (called when user performs actions)
export const updateUserStats = async (userId: string, email: string, displayName?: string): Promise<void> => {
  try {
    const statsRef = collections.user_stats.doc(userId);
    const statsDoc = await statsRef.get();
    
    const now = Timestamp.now();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    if (!statsDoc.exists) {
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
      
      await statsRef.set(newStats);
    } else {
      // Update existing stats
      const currentStats = statsDoc.data() as UserStats;
      
      // Reset monthly counts if it's a new month
      const lastActive = currentStats.lastActiveAt instanceof Timestamp 
        ? currentStats.lastActiveAt.toDate() 
        : new Date(currentStats.lastActiveAt);
      
      const resetMonthlyCounts = lastActive.getMonth() !== currentMonth || 
                                lastActive.getFullYear() !== currentYear;

      await statsRef.update({
        lastActiveAt: now,
        isActive: true,
        displayName: displayName || currentStats.displayName,
        ...(resetMonthlyCounts && {
          inspectionsThisMonth: 0,
          projectsThisMonth: 0
        })
      });
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

// Increment inspection count for user
export const incrementUserInspectionCount = async (userId: string): Promise<void> => {
  try {
    const statsRef = collections.user_stats.doc(userId);
    await statsRef.update({
      totalInspections: FirebaseFirestore.FieldValue.increment(1),
      inspectionsThisMonth: FirebaseFirestore.FieldValue.increment(1),
      lastInspectionAt: Timestamp.now(),
      lastActiveAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error incrementing inspection count:', error);
  }
};

// Increment project count for user
export const incrementUserProjectCount = async (userId: string): Promise<void> => {
  try {
    const statsRef = collections.user_stats.doc(userId);
    await statsRef.update({
      totalProjects: FirebaseFirestore.FieldValue.increment(1),
      projectsThisMonth: FirebaseFirestore.FieldValue.increment(1),
      lastProjectAt: Timestamp.now(),
      lastActiveAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error incrementing project count:', error);
  }
};

// Get all user statistics for admin dashboard
export const getAllUserStats = async (): Promise<UserStats[]> => {
  const snapshot = await collections.user_stats
    .orderBy('lastActiveAt', 'desc')
    .get();

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as UserStats))
    .filter(stats => stats !== null);
};

// ===== ADMIN USER FUNCTIONS =====

// Check if user is admin
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    const adminQuery = await collections.admin_users
      .where('uid', '==', userId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    return !adminQuery.empty;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get admin user details
export const getAdminUser = async (userId: string): Promise<AdminUser | null> => {
  try {
    const adminQuery = await collections.admin_users
      .where('uid', '==', userId)
      .limit(1)
      .get();

    if (adminQuery.empty) {
      return null;
    }

    const doc = adminQuery.docs[0];
    return { id: doc.id, ...doc.data() } as AdminUser;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}; 