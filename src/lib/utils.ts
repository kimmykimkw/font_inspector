import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Client-safe timestamp formatter that works with ISO strings or Date objects
 */
export function formatTimestamp(timestamp: string | Date | undefined | null): string {
  if (!timestamp) return '';
  
  try {
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Handle string timestamps
    return new Date(timestamp).toISOString();
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return '';
  }
}

// Add any other utility functions below...
