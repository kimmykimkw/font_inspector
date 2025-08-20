import { NextResponse } from "next/server";
import { createUserInvitation } from "@/lib/models/admin-service";
import { InvitationRequest } from "@/lib/models/admin";
import { sendNewUserWebhook } from "@/lib/webhook-utils";

// POST /api/request-access - Submit access request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email } = body as InvitationRequest;

    // Validate input
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
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

    // Create invitation request
    const invitation = await createUserInvitation({ name, email });

    console.log(`New access request submitted: ${name} (${email})`);

    // Send webhook notification for new access request
    await sendNewUserWebhook(email.toLowerCase());

    return NextResponse.json({
      success: true,
      message: "Access request submitted successfully",
      invitationId: invitation.id
    });

  } catch (error) {
    console.error('Error processing access request:', error);
    
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
      { error: "Failed to submit access request. Please try again." },
      { status: 500 }
    );
  }
} 