import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firestoreDb } from './firebase-client';

interface LogActivityParams {
  type: 'user_action' | 'admin_action' | 'system_event';
  action: string;
  description: string;
  userId?: string;
  adminId?: string;
  userEmail?: string;
  adminEmail?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    inspectionId?: string;
    projectId?: string;
    duration?: number;
    url?: string;
    urlCount?: number;
    [key: string]: any;
  };
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export async function logActivity(params: LogActivityParams) {
  if (!firestoreDb) {
    console.warn('Firestore not initialized - cannot log activity');
    return;
  }

  try {
    const activityLog = {
      type: params.type,
      action: params.action,
      description: params.description,
      userId: params.userId || null,
      adminId: params.adminId || null,
      userEmail: params.userEmail || null,
      adminEmail: params.adminEmail || null,
      targetUserId: params.targetUserId || null,
      targetUserEmail: params.targetUserEmail || null,
      metadata: params.metadata || null,
      severity: params.severity || 'low',
      timestamp: serverTimestamp()
    };

    await addDoc(collection(firestoreDb, 'activity_logs'), activityLog);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// User action loggers for the main app
export const userActionLogger = {
  inspectionCreated: (userEmail: string, userId: string, inspectionId: string, url: string) =>
    logActivity({
      type: 'user_action',
      action: 'inspection_created',
      description: `User ${userEmail} created inspection for ${url}`,
      userId,
      userEmail,
      metadata: { inspectionId, url },
      severity: 'low'
    }),

  projectCreated: (userEmail: string, userId: string, projectId: string, urlCount: number) =>
    logActivity({
      type: 'user_action',
      action: 'project_created',
      description: `User ${userEmail} created project with ${urlCount} URLs`,
      userId,
      userEmail,
      metadata: { projectId, urlCount },
      severity: 'low'
    }),

  userSignIn: (userEmail: string, userId: string) =>
    logActivity({
      type: 'user_action',
      action: 'user_signin',
      description: `User ${userEmail} signed in`,
      userId,
      userEmail,
      severity: 'low'
    }),

  userSignOut: (userEmail: string, userId: string) =>
    logActivity({
      type: 'user_action',
      action: 'user_signout',
      description: `User ${userEmail} signed out`,
      userId,
      userEmail,
      severity: 'low'
    }),

  accessRequested: (userEmail: string, displayName: string) =>
    logActivity({
      type: 'user_action',
      action: 'access_requested',
      description: `${displayName} (${userEmail}) requested access to Font Inspector`,
      userEmail,
      severity: 'low'
    }),

  inspectionCompleted: (userEmail: string, userId: string, inspectionId: string, url: string, duration: number) =>
    logActivity({
      type: 'user_action',
      action: 'inspection_completed',
      description: `User ${userEmail} completed inspection for ${url}`,
      userId,
      userEmail,
      metadata: { inspectionId, url, duration },
      severity: 'low'
    })
};

// System event loggers
export const systemLogger = {
  error: (errorMessage: string, context?: any) =>
    logActivity({
      type: 'system_event',
      action: 'system_error',
      description: `System error: ${errorMessage}`,
      metadata: context,
      severity: 'high'
    }),

  securityAlert: (alertMessage: string, metadata?: any) =>
    logActivity({
      type: 'system_event',
      action: 'security_alert',
      description: `Security alert: ${alertMessage}`,
      metadata,
      severity: 'critical'
    })
}; 