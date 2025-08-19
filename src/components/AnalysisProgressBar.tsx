import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Globe, Search, FileText, CheckCircle, XCircle, AlertTriangle, Loader2, Clock, AlertCircle } from 'lucide-react';

interface AnalysisProgressBarProps {
  url?: string;
  projectName?: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  isProject?: boolean;
  onComplete?: (resultId: string) => void;
  resultId?: string;
  totalWebsites?: number;
  completedWebsites?: number;
  failedWebsites?: number;
  hasFailures?: boolean;
  errorMessage?: string;
  startTime?: Date; // For long-running inspection indicator
  elapsedTime?: number; // Current elapsed time in seconds
}

export function AnalysisProgressBar({ 
  url, 
  projectName, 
  progress, 
  status, 
  isProject = false,
  onComplete,
  resultId,
  totalWebsites,
  completedWebsites,
  failedWebsites,
  hasFailures,
  errorMessage,
  startTime,
  elapsedTime: propElapsedTime
}: AnalysisProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [stageName, setStageName] = useState('Initializing...');
  const [elapsedTime, setElapsedTime] = useState(propElapsedTime || 0);

  // Update elapsed time every second when processing
  useEffect(() => {
    if (status !== 'processing' || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [status, startTime]);

  // Update from prop if provided
  useEffect(() => {
    if (propElapsedTime !== undefined) {
      setElapsedTime(propElapsedTime);
    }
  }, [propElapsedTime]);

  // Animate progress smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  // Update stage name based on progress, status, and elapsed time
  useEffect(() => {
    if (status === 'failed') {
      setStageName('Analysis failed');
    } else if (status === 'completed') {
      if (hasFailures && completedWebsites && totalWebsites && completedWebsites < totalWebsites) {
        setStageName(`Completed with ${totalWebsites - completedWebsites} failures`);
      } else {
        setStageName('Analysis complete!');
      }
      
      if (onComplete && resultId) {
        setTimeout(() => onComplete(resultId), 500);
      }
    } else if (status === 'processing' && elapsedTime > 0) {
      // Use long-running stage names when processing with elapsed time
      if (elapsedTime < 10) {
        setStageName('Connecting to website...');
      } else if (elapsedTime < 30) {
        setStageName('Loading page content...');
      } else if (elapsedTime < 45) {
        setStageName('Waiting for fonts to load...');
      } else if (elapsedTime < 60) {
        setStageName('Analyzing font declarations...');
      } else if (elapsedTime < 90) {
        setStageName('Processing complex website...');
      } else {
        setStageName('Finalizing inspection...');
      }
    } else if (progress === 0) {
      setStageName('Initializing...');
    } else if (progress < 20) {
      setStageName('Loading websites...');
    } else if (progress < 40) {
      setStageName('Analyzing fonts...');
    } else if (progress < 60) {
      setStageName('Extracting CSS rules...');
    } else if (progress < 80) {
      setStageName('Processing font files...');
    } else if (progress < 100) {
      setStageName('Finalizing results...');
    }
  }, [progress, status, hasFailures, completedWebsites, totalWebsites, onComplete, resultId, elapsedTime]);

  const getProgressColor = (progress: number, status: string, hasFailures?: boolean) => {
    if (status === 'failed') return 'bg-destructive';
    if (hasFailures && status === 'completed') return 'bg-muted-foreground';
    
    // Dynamic color based on elapsed time when processing
    if (status === 'processing' && elapsedTime > 0) {
      if (elapsedTime < 30) {
        return 'bg-blue-600';
      } else if (elapsedTime < 60) {
        return 'bg-amber-600';
      } else {
        return 'bg-orange-600';
      }
    }
    
    return 'bg-foreground';
  };

  // Long-running indicator helper functions
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

  const getLongRunningIcon = () => {
    // Always use spinning icon during processing, checked icon when completed
    if (status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
    }
  };

  const getCardStyle = () => {
    return "bg-card";
  };

  // Calculate display values for website counter
  const displayCompletedWebsites = completedWebsites || 0;
  const displayTotalWebsites = totalWebsites || 0;
  const displayFailedWebsites = failedWebsites || 0;

  // Debug logging
  console.log('AnalysisProgressBar props:', {
    isProject,
    totalWebsites,
    completedWebsites,
    displayTotalWebsites,
    displayCompletedWebsites,
    shouldShow: isProject
  });

  return (
    <div className="flex items-center justify-center p-4">
      <Card className={`w-2xl shadow-lg border ${getCardStyle()}`}>
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center mb-4">
            <div className="mb-4">
              {getLongRunningIcon()}
            </div>
            
            <CardTitle className="text-2xl font-bold text-foreground">
              {status === 'processing' && elapsedTime > 0 ? 'Inspection in Progress' : (isProject ? 'Analyzing Project' : 'Analyzing Website')}
            </CardTitle>
          </div>
          <div className="mt-2 space-y-1">
            {isProject ? (
              <p className="text-lg font-medium text-muted-foreground">{projectName}</p>
            ) : (
              <p className="text-sm text-muted-foreground break-all">{url}</p>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          <div className="space-y-6">
            {/* Website Progress Counter - Always show for projects */}
            {isProject && (
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-2 bg-muted rounded-full border">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'failed' ? 'bg-destructive' :
                      hasFailures ? 'bg-muted-foreground' :
                      'bg-foreground'
                    }`}></div>
                    <span className={`text-sm font-semibold ${
                      status === 'failed' ? 'text-destructive' :
                      hasFailures ? 'text-muted-foreground' :
                      'text-foreground'
                    }`}>
                      {displayCompletedWebsites}/{displayTotalWebsites || 0} webpages completed
                      {hasFailures && displayFailedWebsites > 0 && ` (${displayFailedWebsites} failed)`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">{stageName}</span>
                <div className="flex items-center space-x-2">
                  {status === 'processing' && elapsedTime > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {formatTime(elapsedTime)} elapsed
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">{Math.round(displayProgress)}%</span>
                </div>
              </div>
              
              <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full ${getProgressColor(displayProgress, status, hasFailures)} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${displayProgress}%` }}
                >
                  {/* Animated shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                </div>
              </div>
              
              {/* Long-running progress message */}
              {status === 'processing' && elapsedTime > 0 && (
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{getProgressMessage()}</span>
                </div>
              )}
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-4 gap-4 mt-8">
              {[
                { name: 'Load', threshold: 25, icon: Globe },
                { name: 'Scan', threshold: 50, icon: Search },
                { name: 'Extract', threshold: 75, icon: FileText },
                { name: 'Finish', threshold: 100, icon: CheckCircle }
              ].map((stage, index) => {
                const IconComponent = stage.icon;
                return (
                  <div key={stage.name} className="flex flex-col items-center space-y-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      displayProgress >= stage.threshold
                        ? (status === 'failed' && stage.threshold === 100) 
                          ? 'bg-destructive/10 text-destructive scale-110'
                          : (hasFailures && stage.threshold === 100)
                          ? 'bg-muted text-muted-foreground scale-110'
                          : 'bg-muted text-foreground scale-110'
                        : displayProgress >= stage.threshold - 25
                        ? 'bg-muted/50 text-muted-foreground'
                        : 'bg-muted/30 text-muted-foreground/50'
                    }`}>
                      {displayProgress >= stage.threshold && stage.threshold === 100 ? (
                        status === 'failed' ? (
                          <XCircle className="h-5 w-5" />
                        ) : hasFailures ? (
                          <AlertTriangle className="h-5 w-5" />
                        ) : (
                          <CheckCircle className="h-5 w-5" />
                        )
                      ) : (
                        <IconComponent className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`text-xs font-medium transition-colors duration-300 ${
                      displayProgress >= stage.threshold
                        ? (status === 'failed' && stage.threshold === 100)
                          ? 'text-destructive'
                          : (hasFailures && stage.threshold === 100)
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                        : displayProgress >= stage.threshold - 25
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                    }`}>
                      {stage.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Long-running inspection explanations */}
            {status === 'processing' && elapsedTime > 60 && (
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

            {/* Timeout warning */}
            {status === 'processing' && elapsedTime > 90 && (
              <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded-md">
                <p className="text-xs text-orange-800">
                  <strong>Note:</strong> The inspection will automatically timeout after 2 minutes to prevent indefinite waiting.
                  If successful fonts are detected before timeout, the inspection will complete successfully.
                </p>
              </div>
            )}

            {/* Fixed height message area to prevent layout shift */}
            <div className="h-16 flex items-center justify-center px-4">
              {/* Completion message */}
              {status === 'completed' && (
                <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium max-w-full truncate ${
                  hasFailures 
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-muted text-foreground'
                }`}>
                  {hasFailures 
                    ? 'Analysis completed with some failures. Redirecting...'
                    : 'Analysis complete! Redirecting to results...'
                  }
                </div>
              )}

              {/* Error state */}
              {status === 'failed' && (
                <div className="inline-flex items-center px-4 py-2 bg-destructive/10 text-destructive rounded-full text-sm font-medium max-w-full truncate">
                  {errorMessage || 'Analysis failed. Please try again.'}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 