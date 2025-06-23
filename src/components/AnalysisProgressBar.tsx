import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Globe, Search, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

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
  hasFailures
}: AnalysisProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [stageName, setStageName] = useState('Initializing...');

  // Animate progress smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  // Update stage name based on progress and status
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
  }, [progress, status, hasFailures, completedWebsites, totalWebsites, onComplete, resultId]);

  const getProgressColor = (progress: number, status: string, hasFailures?: boolean) => {
    if (status === 'failed') return 'bg-destructive';
    if (hasFailures && status === 'completed') return 'bg-muted-foreground';
    return 'bg-foreground';
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
      <Card className="w-2xl shadow-lg border bg-card">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-muted-foreground" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {isProject ? 'Analyzing Project' : 'Analyzing Website'}
          </CardTitle>
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
                      {displayCompletedWebsites}/{displayTotalWebsites || 0} websites completed
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
                <span className="text-sm font-bold text-foreground">{Math.round(displayProgress)}%</span>
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
                  Analysis failed. Please try again.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 