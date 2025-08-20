// Admin system data models
import { Timestamp } from 'firebase-admin/firestore';

// User invitation interface
export interface UserInvitation {
  id?: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Timestamp | Date;
  reviewedAt?: Timestamp | Date;
  reviewedBy?: string; // Admin user ID who reviewed
  rejectionReason?: string;
  approvalNotes?: string;
}

// Admin user interface
export interface AdminUser {
  id?: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: AdminPermissions;
  createdAt: Timestamp | Date;
  lastLoginAt?: Timestamp | Date;
  isActive: boolean;
}

// Admin permissions interface
export interface AdminPermissions {
  canApproveUsers: boolean;
  canManageUsers: boolean;
  canViewStats: boolean;
  canManageAdmins: boolean;
  canExportData: boolean;
}

// User permissions interface
export interface UserPermissions {
  id?: string;
  userId: string;
  canUseApp: boolean;
  maxInspectionsPerMonth: number;
  maxProjectsPerMonth: number;
  suspendedUntil?: Timestamp | Date;
  suspensionReason?: string;
  notes?: string;
  updatedAt: Timestamp | Date;
  updatedBy: string; // Admin user ID
}

// User statistics interface
export interface UserStats {
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  totalInspections: number;
  totalProjects: number;
  inspectionsThisMonth: number;
  projectsThisMonth: number;
  lastInspectionAt?: Timestamp | Date;
  lastProjectAt?: Timestamp | Date;
  joinedAt: Timestamp | Date;
  lastActiveAt: Timestamp | Date;
  isActive: boolean;
}

// Email registration interface (for email/password users)
export interface EmailRegistration {
  id?: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  registrationType: 'email_password';
  requestedAt: Timestamp | Date;
  reviewedAt?: Timestamp | Date;
  reviewedBy?: string; // Admin user ID who reviewed
  rejectionReason?: string;
  approvalNotes?: string;
}

// Email registration request data (for frontend forms)
export interface EmailRegistrationRequest {
  name: string;
  email: string;
  password: string;
}

// Invitation request data (for frontend forms)
export interface InvitationRequest {
  name: string;
  email: string;
} 