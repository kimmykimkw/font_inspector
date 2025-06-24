import { auth } from '@/lib/firebase';
import { isUserAuthorized } from '@/lib/models/admin-service';
import logger from './logger';

/**
 * Get the authenticated user from the request
 * This extracts the user ID from the Firebase Auth token
 */
export async function getAuthenticatedUser(request: Request): Promise<string | null> {
  try {
    logger.debug('Starting authentication verification...');
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      logger.debug('No authorization header found');
      return null;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      logger.debug('Authorization header does not start with Bearer');
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      logger.debug('No ID token found after Bearer');
      return null;
    }

    logger.debug('Attempting to verify ID token');

    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(idToken);
    
    if (!decodedToken.uid) {
      logger.debug('No UID found in decoded token');
      return null;
    }

    logger.debug('Authentication successful');
    return decodedToken.uid;
  } catch (error) {
    logger.error('Error verifying authentication:', error);
    
    // Log specific error details
    if (error instanceof Error) {
      if (error.message.includes('Firebase ID token has expired')) {
        logger.warn('Token has expired - client should refresh');
      } else if (error.message.includes('Firebase ID token has invalid signature')) {
        logger.warn('Token has invalid signature');
      } else if (error.message.includes('Firebase ID token has incorrect "aud"')) {
        logger.warn('Token has incorrect audience');
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
      logger.debug('No email found in token');
      return null;
    }

    // Check if user is authorized to use the app
    const authorized = await isUserAuthorized(email);
    
    if (!authorized) {
      logger.debug('User not authorized');
      return null;
    }

    logger.debug('User authorized successfully');
    return { userId, email };
  } catch (error) {
    logger.error('Error verifying authorization:', error);
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