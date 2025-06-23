import { Timestamp } from 'firebase-admin/firestore';

/**
 * Formats a Firebase Timestamp, Date object, or string as an ISO string
 * This is for SERVER-SIDE use only - do not import in client components
 */
export function formatTimestamp(timestamp: Timestamp | Date | string | undefined | null): string {
  if (!timestamp) return '';
  
  try {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toISOString();
    } else if (timestamp instanceof Date) {
      return timestamp.toISOString();
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp).toISOString();
    }
  } catch (e) {
    console.error('Error formatting timestamp:', e);
  }
  
  return '';
}

// Add other server-side utilities below 