import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// POST /api/admin/email-registrations/approve - Approve email registration
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUserId = await getAuthenticatedUser(request);
    if (!adminUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { registrationId, action, reason } = body;

    if (!registrationId || !action) {
      return NextResponse.json(
        { error: "Registration ID and action are required" },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    console.log(`🔧 Processing ${action} for registration:`, registrationId);

    // Get the registration document
    const registrationDoc = await collections.email_registrations.doc(registrationId).get();
    
    if (!registrationDoc.exists) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    const registration = registrationDoc.data();
    if (!registration) {
      return NextResponse.json(
        { error: "Invalid registration data" },
        { status: 400 }
      );
    }

    if (registration.status !== 'pending') {
      return NextResponse.json(
        { error: "Registration has already been reviewed" },
        { status: 409 }
      );
    }

    if (action === 'approve') {
      // Create Firebase user account
      const auth = getAuth();
      let firebaseUser;
      
      try {
        firebaseUser = await auth.createUser({
          email: registration.email,
          password: registration.tempPassword, // Use the temporarily stored password
          displayName: registration.name,
          emailVerified: true // Skip email verification as requested
        });
        
        console.log(`✅ Created Firebase user: ${firebaseUser.uid} for ${registration.email}`);
      } catch (firebaseError: any) {
        console.error('Error creating Firebase user:', firebaseError);
        if (firebaseError.code === 'auth/email-already-exists') {
          return NextResponse.json(
            { error: "Email address is already in use" },
            { status: 409 }
          );
        }
        throw firebaseError;
      }

      // Get current default permissions from settings
      let defaultLimits = { maxInspectionsPerMonth: 1000, maxProjectsPerMonth: 300 }; // Fallback
      try {
        const settingsSnapshot = await collections.system_settings.get();
        const defaultLimitsDoc = settingsSnapshot.docs.find(doc => doc.id === 'default_limits');
        if (defaultLimitsDoc) {
          const settings = defaultLimitsDoc.data();
          defaultLimits = {
            maxInspectionsPerMonth: settings.defaultMaxInspectionsPerMonth || 1000,
            maxProjectsPerMonth: settings.defaultMaxProjectsPerMonth || 300
          };
        }
      } catch (error) {
        console.warn('Failed to fetch admin settings, using fallback limits:', error);
      }

      // Update registration status
      await collections.email_registrations.doc(registrationId).update({
        status: 'approved',
        reviewedAt: Timestamp.now(),
        reviewedBy: adminUserId,
        approvalNotes: 'Approved by admin - Firebase user created',
        firebaseUid: firebaseUser.uid,
        tempPassword: null // Remove temporary password
      });

      // Create user permissions
      await collections.user_permissions.add({
        userId: firebaseUser.uid, // Use Firebase UID
        canUseApp: true,
        maxInspectionsPerMonth: defaultLimits.maxInspectionsPerMonth,
        maxProjectsPerMonth: defaultLimits.maxProjectsPerMonth,
        updatedAt: Timestamp.now(),
        updatedBy: adminUserId
      });

      // Create user profile
      await collections.users.doc(firebaseUser.uid).set({
        uid: firebaseUser.uid,
        email: registration.email.toLowerCase(),
        displayName: registration.name,
        photoURL: null,
        authProvider: 'email_password',
        createdAt: Timestamp.now(),
        lastLoginAt: null,
        appVersion: null
      });

      console.log(`✅ Approved email registration for ${registration.email}`);

      return NextResponse.json({
        success: true,
        message: "Registration approved successfully",
        firebaseUid: firebaseUser.uid
      });

    } else if (action === 'reject') {
      // Update registration status
      await collections.email_registrations.doc(registrationId).update({
        status: 'rejected',
        reviewedAt: Timestamp.now(),
        reviewedBy: adminUserId,
        rejectionReason: reason || 'Registration rejected by admin',
        tempPassword: null // Remove temporary password
      });

      console.log(`❌ Rejected email registration for ${registration.email}`);

      return NextResponse.json({
        success: true,
        message: "Registration rejected successfully"
      });
    }

  } catch (error) {
    console.error('Error processing email registration approval:', error);
    return NextResponse.json(
      { error: "Failed to process registration approval" },
      { status: 500 }
    );
  }
}
