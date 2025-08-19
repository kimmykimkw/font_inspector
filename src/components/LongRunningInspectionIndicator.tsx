"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from "./ui/card";
import { Loader2, AlertCircle } from "lucide-react";

interface LongRunningInspectionIndicatorProps {
  isVisible: boolean;
  url: string;
  startTime?: Date;
  onCancel?: () => void;
}

export function LongRunningInspectionIndicator({ 
  isVisible, 
  url, 
  startTime,
  onCancel 
}: LongRunningInspectionIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [stage, setStage] = useState('Connecting to website...');

  // Update elapsed time every second
  useEffect(() => {
    if (!isVisible || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, startTime]);

  // Update stage based on elapsed time
  useEffect(() => {
    if (elapsedTime < 10) {
      setStage('Connecting to website...');
    } else if (elapsedTime < 30) {
      setStage('Loading page content...');
    } else if (elapsedTime < 45) {
      setStage('Waiting for fonts to load...');
    } else if (elapsedTime < 60) {
      setStage('Analyzing font declarations...');
    } else if (elapsedTime < 90) {
      setStage('Processing complex website...');
    } else {
      setStage('Finalizing inspection...');
    }
  }, [elapsedTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getProgressMessage = () => {
    if (elapsedTime < 30) {
      return "This is normal for most websites.";
    } else if (elapsedTime < 60) {
      return "Some websites take longer to load completely.";
    } else {
      return "This website has complex content that requires extra processing time.";
    }
  };

  const getIcon = () => {
    // Always use spinning icon during processing
    return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
  };

  const getCardStyle = () => {
    if (elapsedTime < 30) {
      return "border-blue-200 bg-blue-50";
    } else if (elapsedTime < 60) {
      return "border-amber-200 bg-amber-50";
    } else {
      return "border-orange-200 bg-orange-50";
    }
  };

  if (!isVisible) return null;

  return (
    <Card className={`w-full ${getCardStyle()}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {getIcon()}
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-lg">Inspection in Progress</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing: <span className="font-medium">{url}</span>
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{stage}</span>
                <span className="text-sm text-muted-foreground">
                  {formatTime(elapsedTime)} elapsed
                </span>
              </div>
              
              {/* Animated progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-1000 ${
                    elapsedTime < 30 ? 'bg-blue-600' : 
                    elapsedTime < 60 ? 'bg-amber-600' : 
                    'bg-orange-600'
                  }`}
                  style={{ 
                    width: `${Math.min(90, (elapsedTime / 120) * 100)}%`,
                    animation: 'pulse 2s infinite'
                  }}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {getProgressMessage()}
            </p>

            {/* Show additional info for long-running inspections */}
            {elapsedTime > 60 && (
              <div className="mt-4 p-3 bg-white/50 rounded-md border">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Why is this taking so long?</p>
                    <ul className="space-y-1">
                      <li>• The website may have continuous background activity</li>
                      <li>• Complex animations or media are still loading</li>
                      <li>• Multiple font sources are being processed</li>
                      <li>• The site may have slow response times</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Show timeout warning */}
            {elapsedTime > 90 && (
              <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded-md">
                <p className="text-xs text-orange-800">
                  <strong>Note:</strong> The inspection will automatically timeout after 2 minutes to prevent indefinite waiting.
                  If successful fonts are detected before timeout, the inspection will complete successfully.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
