import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase";
import { EmailRegistration } from "@/lib/models/admin";
import { getAuthenticatedUser } from "@/lib/auth-utils";

// GET /api/admin/email-registrations - Get all email registration requests
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const userId = await getAuthenticatedUser(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user is admin (you might want to implement proper admin role checking)
    // For now, we'll assume any authenticated user can access this endpoint
    // In production, you should verify admin permissions here

    console.log('🔍 Fetching email registrations for admin:', userId);

    // Fetch all email registrations
    const registrationsSnapshot = await collections.email_registrations
      .orderBy('requestedAt', 'desc')
      .get();

    const registrations: EmailRegistration[] = registrationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as EmailRegistration[];

    console.log(`✅ Found ${registrations.length} email registrations`);

    return NextResponse.json({
      success: true,
      registrations
    });

  } catch (error) {
    console.error('Error fetching email registrations:', error);
    return NextResponse.json(
      { error: "Failed to fetch email registrations" },
      { status: 500 }
    );
  }
}
