import { NextRequest, NextResponse } from 'next/server';
import { 
  getAnnouncementById, 
  updateAnnouncement, 
  deleteAnnouncement, 
  toggleAnnouncementStatus 
} from '@/lib/models/announcement-service';
import { getAuthorizedUser } from '@/lib/auth-utils';
import { isUserAdmin } from '@/lib/models/admin-service';
import logger from '@/lib/logger';

// Get single announcement by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    const announcement = await getAnnouncementById(params.id);
    
    if (!announcement) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      announcement
    });

  } catch (error) {
    logger.error('Error getting announcement:', error);
    return NextResponse.json(
      { error: 'Failed to get announcement' },
      { status: 500 }
    );
  }
}

// Update announcement
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    const body = await request.json();
    
    // Validate fields if provided
    const updates: any = {};
    
    if (body.title !== undefined) {
      if (typeof body.title !== 'string') {
        return NextResponse.json(
          { error: 'Title must be a string' },
          { status: 400 }
        );
      }
      updates.title = body.title;
    }
    
    if (body.message !== undefined) {
      if (typeof body.message !== 'string') {
        return NextResponse.json(
          { error: 'Message must be a string' },
          { status: 400 }
        );
      }
      updates.message = body.message;
    }

    if (body.type !== undefined) {
      if (!['info', 'warning', 'success', 'error'].includes(body.type)) {
        return NextResponse.json(
          { error: 'Type must be one of: info, warning, success, error' },
          { status: 400 }
        );
      }
      updates.type = body.type;
    }

    if (body.priority !== undefined) {
      if (typeof body.priority !== 'number' || body.priority < 0 || body.priority > 100) {
        return NextResponse.json(
          { error: 'Priority must be a number between 0 and 100' },
          { status: 400 }
        );
      }
      updates.priority = body.priority;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return NextResponse.json(
          { error: 'isActive must be a boolean' },
          { status: 400 }
        );
      }
      updates.isActive = body.isActive;
    }

    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null) {
        updates.expiresAt = null; // Remove expiration
      } else {
        const expirationDate = new Date(body.expiresAt);
        if (isNaN(expirationDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid expiration date format' },
            { status: 400 }
          );
        }
        updates.expiresAt = expirationDate;
      }
    }

    // Update announcement
    const updatedAnnouncement = await updateAnnouncement(
      params.id, 
      updates, 
      userInfo.userId
    );

    logger.info(`Announcement updated by admin ${userInfo.userId}: ${params.id}`);

    return NextResponse.json({
      success: true,
      announcement: updatedAnnouncement
    });

  } catch (error) {
    logger.error('Error updating announcement:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update announcement' },
      { status: 500 }
    );
  }
}

// Delete announcement
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    // Check if announcement exists
    const announcement = await getAnnouncementById(params.id);
    if (!announcement) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      );
    }

    // Delete announcement
    await deleteAnnouncement(params.id, userInfo.userId);

    logger.info(`Announcement deleted by admin ${userInfo.userId}: ${params.id}`);

    return NextResponse.json({
      success: true,
      message: 'Announcement deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting announcement:', error);
    return NextResponse.json(
      { error: 'Failed to delete announcement' },
      { status: 500 }
    );
  }
}

// PATCH endpoint for toggling status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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

    const body = await request.json();
    
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive field is required and must be a boolean' },
        { status: 400 }
      );
    }

    // Toggle announcement status
    const updatedAnnouncement = await toggleAnnouncementStatus(
      params.id, 
      body.isActive, 
      userInfo.userId
    );

    logger.info(`Announcement status toggled by admin ${userInfo.userId}: ${params.id} -> ${body.isActive}`);

    return NextResponse.json({
      success: true,
      announcement: updatedAnnouncement
    });

  } catch (error) {
    logger.error('Error toggling announcement status:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to toggle announcement status' },
      { status: 500 }
    );
  }
}
