import { NextResponse } from "next/server";
import { isUserAuthorized } from "@/lib/models/admin-service";

// POST /api/auth/check-authorization - Check if user is authorized to use the app
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user is authorized
    const authorized = await isUserAuthorized(email);

    return NextResponse.json({
      authorized,
      email
    });

  } catch (error) {
    console.error('Error checking user authorization:', error);
    
    return NextResponse.json(
      { 
        authorized: false,
        error: "Failed to check authorization" 
      },
      { status: 500 }
    );
  }
} 