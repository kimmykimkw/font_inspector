import { NextRequest, NextResponse } from 'next/server';
import { getActiveAnnouncements, getAllAnnouncements, createAnnouncement } from '@/lib/models/announcement-service';
import { getAuthorizedUser } from '@/lib/auth-utils';
import { isUserAdmin } from '@/lib/models/admin-service';
import logger from '@/lib/logger';

// Get announcements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminOnly = searchParams.get('admin') === 'true';
    
    if (adminOnly) {
      // Admin endpoint - get all announcements
      // For now, allow admin requests without complex auth
      const announcements = await getAllAnnouncements();
      
      return NextResponse.json({
        success: true,
        announcements
      });
    } else {
      // Public endpoint - get active announcements only
      const announcements = await getActiveAnnouncements();
      
      return NextResponse.json({
        success: true,
        announcements
      });
    }

  } catch (error) {
    logger.error('Error getting announcements:', error);
    return NextResponse.json(
      { error: 'Failed to get announcements' },
      { status: 500 }
    );
  }
}

// Create new announcement (admin only)
export async function POST(request: NextRequest) {
  try {
    // For now, bypass authentication for admin panel - use a simple check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Try to get user info for full auth
      const userInfo = await getAuthorizedUser(request);
      
      if (!userInfo) {
        return NextResponse.json(
          { error: 'Unauthorized - No valid authentication' },
          { status: 401 }
        );
      }

      // Check if user is admin
      const isAdmin = await isUserAdmin(userInfo.userId);
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate optional fields
    const type = body.type || 'info';
    if (!['info', 'warning', 'success', 'error'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be one of: info, warning, success, error' },
        { status: 400 }
      );
    }

    const priority = typeof body.priority === 'number' ? body.priority : 50;
    if (priority < 0 || priority > 100) {
      return NextResponse.json(
        { error: 'Priority must be between 0 and 100' },
        { status: 400 }
      );
    }

    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
    
    // Handle expiration date
    let expiresAt = undefined;
    if (body.expiresAt) {
      const expirationDate = new Date(body.expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expiration date format' },
          { status: 400 }
        );
      }
      expiresAt = expirationDate;
    }

    // Create announcement - use a default admin ID if no user info
    const adminUserId = 'admin-user'; // Default admin ID for announcements
    const announcement = await createAnnouncement({
      title: body.title,
      message: body.message,
      type,
      isActive,
      priority,
      ...(expiresAt && { expiresAt })
    }, adminUserId);

    logger.info(`Announcement created by admin ${adminUserId}: ${announcement.title}`);

    return NextResponse.json({
      success: true,
      announcement
    });

  } catch (error) {
    logger.error('Error creating announcement:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    );
  }
}
