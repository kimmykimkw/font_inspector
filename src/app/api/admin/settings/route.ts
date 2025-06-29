import { NextRequest, NextResponse } from 'next/server';
import { getSystemSettings, updateSystemSettings } from '@/lib/models/settings-service';
import { getAuthorizedUser } from '@/lib/auth-utils';
import { isUserAdmin } from '@/lib/models/admin-service';
import logger from '@/lib/logger';

// Get system settings
export async function GET(request: NextRequest) {
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

    const settings = await getSystemSettings();
    
    return NextResponse.json({
      success: true,
      settings
    });

  } catch (error) {
    logger.error('Error getting system settings:', error);
    return NextResponse.json(
      { error: 'Failed to get system settings' },
      { status: 500 }
    );
  }
}

// Update system settings
export async function PUT(request: NextRequest) {
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
    
    // Validate required fields
    if (typeof body.defaultMaxInspectionsPerMonth !== 'number' || 
        typeof body.defaultMaxProjectsPerMonth !== 'number') {
      return NextResponse.json(
        { error: 'Invalid settings data' },
        { status: 400 }
      );
    }

    // Update settings
    const updatedSettings = await updateSystemSettings({
      defaultMaxInspectionsPerMonth: body.defaultMaxInspectionsPerMonth,
      defaultMaxProjectsPerMonth: body.defaultMaxProjectsPerMonth
    }, userInfo.userId);

    logger.info(`System settings updated by admin ${userInfo.userId}`);

    return NextResponse.json({
      success: true,
      settings: updatedSettings
    });

  } catch (error) {
    logger.error('Error updating system settings:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update system settings' },
      { status: 500 }
    );
  }
} 