'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

// Announcement interface (client-side version)
interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isActive: boolean;
  priority: number;
  createdAt: any; // Firebase timestamp
  updatedAt: any; // Firebase timestamp
  expiresAt?: any; // Optional expiration date
}

interface AnnouncementBannerProps {
  className?: string;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ className = '' }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active announcements
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/announcements');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch announcements');
      }
      
      if (data.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError(err instanceof Error ? err.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };



  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getAnnouncementStyles = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-900';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-900';
      case 'success':
        return 'border-green-200 bg-green-50 text-green-900';
      default:
        return 'border-blue-200 bg-blue-50 text-blue-900';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      // Handle Firebase timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, yyyy');
    } catch (err) {
      return '';
    }
  };

  const isExpired = (announcement: Announcement) => {
    if (!announcement.expiresAt) return false;
    try {
      const expirationDate = announcement.expiresAt.toDate ? 
        announcement.expiresAt.toDate() : 
        new Date(announcement.expiresAt);
      return expirationDate < new Date();
    } catch (err) {
      return false;
    }
  };

  // Filter announcements that should be shown
  const visibleAnnouncements = announcements.filter(announcement => 
    !isExpired(announcement) &&
    announcement.isActive
  );

  // Don't render anything if loading, error, or no announcements
  if (loading || error || visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {visibleAnnouncements.map((announcement) => (
        <Card 
          key={announcement.id} 
          className={`border-l-4 ${getAnnouncementStyles(announcement.type)}`}
        >
          <CardContent className="p-1.5">
            <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  {getAnnouncementIcon(announcement.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm mb-1">
                    {announcement.title}
                  </h3>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {announcement.message}
                  </div>
                  {announcement.createdAt && (
                    <div className="text-xs opacity-60 mt-1">
                      <span>{formatDate(announcement.createdAt)}</span>
                      {announcement.expiresAt && (
                        <span className="ml-2">
                          • Expires {formatDate(announcement.expiresAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
