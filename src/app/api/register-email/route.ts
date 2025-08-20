import { NextResponse } from "next/server";
import { collections } from "@/lib/firebase";
import { EmailRegistrationRequest } from "@/lib/models/admin";
import { Timestamp } from 'firebase-admin/firestore';
import { sendNewUserWebhook } from "@/lib/webhook-utils";

// POST /api/register-email - Submit email/password registration request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body as EmailRegistrationRequest;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase();

    // Check if user already has a pending or approved Google invitation
    const existingInvitationQuery = await collections.user_invitations
      .where('email', '==', emailLower)
      .limit(1)
      .get();

    if (!existingInvitationQuery.empty) {
      const invitation = existingInvitationQuery.docs[0].data();
      if (invitation.status === 'approved') {
        return NextResponse.json(
          { error: "This email already has access to Font Inspector. Please use Google Sign-In." },
          { status: 409 }
        );
      } else if (invitation.status === 'pending') {
        return NextResponse.json(
          { error: "This email already has a pending access request. Please use Google Sign-In." },
          { status: 409 }
        );
      }
    }

    // Check if user already has a pending or approved email registration
    const existingRegistrationQuery = await collections.email_registrations
      .where('email', '==', emailLower)
      .limit(1)
      .get();

    if (!existingRegistrationQuery.empty) {
      const registration = existingRegistrationQuery.docs[0].data();
      if (registration.status === 'approved') {
        return NextResponse.json(
          { error: "This email already has access to Font Inspector. Please sign in." },
          { status: 409 }
        );
      } else if (registration.status === 'pending') {
        return NextResponse.json(
          { error: "This email already has a pending registration request." },
          { status: 409 }
        );
      }
    }

    // Create email registration request (don't create Firebase user yet)
    const registrationData = {
      name: name.trim(),
      email: emailLower,
      status: 'pending' as const,
      registrationType: 'email_password' as const,
      requestedAt: Timestamp.now(),
      // Note: We store the password temporarily for admin approval
      // In a production system, you might want to encrypt this or handle it differently
      tempPassword: password
    };

    const docRef = await collections.email_registrations.add(registrationData);

    console.log(`New email registration request submitted: ${name} (${emailLower})`);

    // Send webhook notification for new email registration
    await sendNewUserWebhook(emailLower);

    return NextResponse.json({
      success: true,
      message: "Registration request submitted successfully",
      registrationId: docRef.id
    });

  } catch (error) {
    console.error('Error processing email registration request:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already has access') || 
          error.message.includes('already pending')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 } // Conflict
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to submit registration request. Please try again." },
      { status: 500 }
    );
  }
}
