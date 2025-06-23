import { auth } from '@/lib/firebase';
import { isUserAuthorized } from '@/lib/models/admin-service';

/**
 * Get the authenticated user from the request
 * This extracts the user ID from the Firebase Auth token
 */
export async function getAuthenticatedUser(request: Request): Promise<string | null> {
  try {
    console.log('Auth Utils: Starting authentication verification...');
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      console.log('Auth Utils: No authorization header found');
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('Auth Utils: Authorization header does not start with Bearer:', authHeader.substring(0, 20));
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      console.log('Auth Utils: No ID token found after Bearer');
      return null;
    }

    console.log('Auth Utils: Attempting to verify ID token (length:', idToken.length, ')');

    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(idToken);
    
    console.log('Auth Utils: Token decoded successfully');
    
    if (!decodedToken.uid) {
      console.log('Auth Utils: No UID found in decoded token');
      return null;
    }

    console.log('Auth Utils: Authentication successful for user:', decodedToken.uid);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth Utils: Error verifying authentication:', error);
    
    // Log specific error details
    if (error instanceof Error) {
      console.error('Auth Utils: Error name:', error.name);
      console.error('Auth Utils: Error message:', error.message);
      if (error.message.includes('Firebase ID token has expired')) {
        console.error('Auth Utils: Token has expired - client should refresh');
      } else if (error.message.includes('Firebase ID token has invalid signature')) {
        console.error('Auth Utils: Token has invalid signature');
      } else if (error.message.includes('Firebase ID token has incorrect "aud"')) {
        console.error('Auth Utils: Token has incorrect audience');
      }
    }
    
    return null;
  }
}

/**
 * Get the authenticated user and verify authorization
 * This checks both authentication and user access permissions
 */
export async function getAuthorizedUser(request: Request): Promise<{ userId: string; email: string } | null> {
  try {
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      return null;
    }

    // Get the user's email from the token
    const authHeader = request.headers.get('authorization');
    const idToken = authHeader?.split('Bearer ')[1];
    
    if (!idToken) {
      return null;
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    const email = decodedToken.email;

    if (!email) {
      console.log('Auth Utils: No email found in token');
      return null;
    }

    // Check if user is authorized to use the app
    const authorized = await isUserAuthorized(email);
    
    if (!authorized) {
      console.log('Auth Utils: User not authorized:', email);
      return null;
    }

    console.log('Auth Utils: User authorized successfully:', email);
    return { userId, email };
  } catch (error) {
    console.error('Auth Utils: Error verifying authorization:', error);
    return null;
  }
}

/**
 * Create authorization response for unauthenticated requests
 */
export function createUnauthorizedResponse() {
  return Response.json(
    { 
      error: "Authentication required", 
      details: "Please provide a valid Firebase ID token in the Authorization header" 
    },
    { status: 401 }
  );
}

/**
 * Create authorization response for unauthorized requests (authenticated but not approved)
 */
export function createForbiddenResponse() {
  return Response.json(
    { 
      error: "Access not authorized", 
      details: "Your account does not have permission to access this application. Please request access first." 
    },
    { status: 403 }
  );
} 