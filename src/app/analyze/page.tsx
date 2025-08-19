"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnalysisProgressBar } from '@/components/AnalysisProgressBar';
import { useInspection } from '@/contexts/InspectionContext';
import { apiClient, authenticatedFetch } from '@/lib/api-client';
import { AuthWrapper } from '@/components/auth/AuthWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { addToQueue, queue } = useInspection();
  
  console.log('AnalyzeContent render - Auth state:');
  console.log('- authLoading:', authLoading);
  console.log('- user:', !!user);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [analysisState, setAnalysisState] = useState({
    progress: 0,
    status: 'pending' as 'pending' | 'processing' | 'completed' | 'failed',
    resultId: null as string | null
  });
  
  // Track discovered URLs for multi-page inspections
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  
  // Prevent duplicate analysis starts due to React Strict Mode
  const analysisStartedRef = useRef(false);
  
  // Get parameters from URL
  const url = searchParams.get('url');
  const projectName = searchParams.get('projectName');
  const urls = useMemo(() => searchParams.get('urls')?.split(',') || [], [searchParams]);
  const isProject = searchParams.get('type') === 'project';
  const isMultiPage = searchParams.get('type') === 'multi-page';
  const pageCount = searchParams.get('pageCount') ? parseInt(searchParams.get('pageCount')!) : 1;

  // Debug URL parsing
  console.log('URL Parameters:');
  console.log('- url:', url);
  console.log('- projectName:', projectName);
  console.log('- urls:', urls);
  console.log('- urlsLength:', urls.length);
  console.log('- isProject:', isProject);
  console.log('- isMultiPage:', isMultiPage);
  console.log('- pageCount:', pageCount);
  console.log('- searchParamsString:', searchParams.toString());

  // Additional debug for URLs array
  console.log('URLs array details:', urls.map((u, i) => `${i}: "${u}"`));

  // Calculate progress from queue for this project
  const projectUrls = useMemo(() => {
    if (isProject) return urls;
    if (isMultiPage) return discoveredUrls.length > 0 ? discoveredUrls : [];
    return url ? [url] : [];
  }, [isProject, isMultiPage, url, urls, discoveredUrls]);

  console.log('Project URLs calculated:', {
    projectUrls,
    projectUrlsLength: projectUrls.length
  });

  // Filter queue items for current analysis
  const currentQueueItems = useMemo(() => {
    if (!projectUrls.length) return [];
    return queue.filter(item => projectUrls.includes(item.url));
  }, [queue, projectUrls]);

  // Calculate real progress and completion stats
  const { realProgress, completedWebsites, totalWebsites, hasFailures, errorMessage } = useMemo(() => {
    if (!projectUrls.length) return { realProgress: 0, completedWebsites: 0, totalWebsites: 0, hasFailures: false, errorMessage: undefined };
    
    const total = projectUrls.length;
    
    // Debug logging
    console.log('Progress calculation:', {
      projectUrls,
      total,
      currentQueueItems: currentQueueItems.length,
      queueUrls: currentQueueItems.map(item => ({ url: item.url, status: item.status }))
    });
    
    const completed = currentQueueItems.filter(item => 
      item.status === 'completed' || item.status === 'failed'
    ).length;
    const successful = currentQueueItems.filter(item => item.status === 'completed').length;
    const failed = currentQueueItems.filter(item => item.status === 'failed').length;
    const failedItems = currentQueueItems.filter(item => item.status === 'failed');
    
    // Extract error message from failed items
    let extractedErrorMessage = undefined;
    if (failed > 0) {
      // For single URL failures, show the specific error
      if (total === 1 && failedItems.length === 1) {
        extractedErrorMessage = failedItems[0].error;
      } else if (failed === total) {
        // All failed - show the first error or a generic message
        extractedErrorMessage = failedItems[0]?.error || 'All inspections failed';
      } else {
        // Some failed - show count of failures
        extractedErrorMessage = `${failed} out of ${total} inspections failed`;
      }
    }
    
    let progress = 0;
    if (total > 0) {
      if (currentQueueItems.length === 0) {
        // No queue items yet, show minimal progress if processing started
        progress = analysisState.status === 'processing' ? 5 : 0;
      } else {
        // Base progress on completion
        progress = (completed / total) * 100;
        
        // Add partial progress for items currently processing
        const processing = currentQueueItems.filter(item => item.status === 'processing');
        processing.forEach(item => {
          progress += (item.progress / total);
        });
      }
    }
    
    console.log('Calculated progress:', {
      progress: Math.min(progress, 100),
      completed,
      successful,
      failed,
      total,
      errorMessage: extractedErrorMessage
    });
    
    return {
      realProgress: Math.min(progress, 100),
      completedWebsites: successful,
      totalWebsites: total, // Always use the original URL count
      hasFailures: failed > 0,
      errorMessage: extractedErrorMessage
    };
  }, [projectUrls, currentQueueItems, analysisState.status]);

  // Update analysis state based on queue progress
  useEffect(() => {
    if (!isInitialized || !projectUrls.length) return;

    const allCompleted = currentQueueItems.length === projectUrls.length && 
                        currentQueueItems.every(item => 
                          item.status === 'completed' || item.status === 'failed'
                        );
    
    const hasAnySuccess = currentQueueItems.some(item => item.status === 'completed');
    const allFailed = currentQueueItems.length === projectUrls.length && 
                     currentQueueItems.every(item => item.status === 'failed');

    if (allCompleted) {
      if (allFailed) {
        setAnalysisState(prev => ({ 
          ...prev, 
          progress: 100, 
          status: 'failed' 
        }));
      } else {
        // At least some succeeded
        const successfulItem = currentQueueItems.find(item => item.status === 'completed');
        setAnalysisState(prev => ({ 
          ...prev, 
          progress: 100, 
          status: 'completed',
          resultId: successfulItem?.backendId || null
        }));
      }
    } else if (currentQueueItems.some(item => item.status === 'processing')) {
      setAnalysisState(prev => ({ 
        ...prev, 
        progress: realProgress, 
        status: 'processing' 
      }));
    }
  }, [currentQueueItems, projectUrls, realProgress, isInitialized]);

  const startAnalysis = useCallback(async () => {
    // Double-check to prevent duplicate starts
    if (analysisStartedRef.current && analysisState.status !== 'pending') {
      console.log('Analysis already started, skipping duplicate start');
      return;
    }

    try {
      setAnalysisState(prev => ({ ...prev, status: 'processing', progress: 10 }));
      
      console.log('Analysis conditions check:', { isProject, projectName, urlsLength: urls.length });
      
      if (isProject && projectName && urls.length > 0) {
        console.log('Starting project analysis with URLs:', urls);
        // Use the inspection context's addToQueue method to handle project creation
        await addToQueue(urls, projectName);
        // Progress will be tracked via queue updates
        
      } else if (isMultiPage && url && pageCount > 1) {
        // Multi-page inspection - discover pages first
        console.log(`Starting page discovery for ${url} (${pageCount} pages)`);
        
        try {
          // Call page discovery API with authentication
          const response = await authenticatedFetch('/api/discover-pages', {
            method: 'POST',
            body: JSON.stringify({
              url: url,
              pageCount: pageCount
            })
          });
          
          if (!response.ok) {
            throw new Error(`Page discovery failed: ${response.statusText}`);
          }
          
          const discoveryResult = await response.json();
          console.log('Page discovery result:', discoveryResult);
          
          if (!discoveryResult.success || !discoveryResult.pages || discoveryResult.pages.length === 0) {
            throw new Error('No pages discovered');
          }
          
          // Extract URLs from discovered pages and ensure uniqueness
          const discoveredPageUrls = [...new Set(discoveryResult.pages.map((page: any) => page.url))];
          
          // Limit to requested page count (in case discovery found more than requested)
          const finalUrls = discoveredPageUrls.slice(0, pageCount);
          
          // Update state with discovered URLs for progress tracking
          setDiscoveredUrls(finalUrls);
          
          // Create a project name based on the domain
          const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
          const autoProjectName = `Website Analysis: ${domain}`;
          
          console.log(`Creating auto-project "${autoProjectName}" with ${finalUrls.length} pages (requested: ${pageCount})`);
          
          // Use the inspection context's addToQueue method to handle project creation
          await addToQueue(finalUrls, autoProjectName);
          // Progress will be tracked via queue updates
          
        } catch (discoveryError) {
          console.error('Page discovery failed:', discoveryError);
          toast.error(`Page discovery failed: ${discoveryError instanceof Error ? discoveryError.message : 'Unknown error'}`);
          
          // Fallback to single page inspection
          console.log('Falling back to single page inspection');
          await addToQueue([url]);
        }
        
      } else if (url) {
        // Start single URL analysis
        await addToQueue([url]);
        // Progress will be tracked via queue updates
      }
    } catch (error) {
      console.error('Failed to start analysis:', error);
      setAnalysisState(prev => ({ ...prev, status: 'failed' }));
      
      // Show detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Analysis failed: ${errorMessage}`);
    }
  }, [url, projectName, urls, isProject, isMultiPage, pageCount, addToQueue, analysisState.status]);

  // Initialize analysis
  useEffect(() => {
    const canStartAnalysis = (url || isProject || isMultiPage) && (
      (!isProject && !isMultiPage) || // Single page
      (isProject && projectName && urls.length > 0) || // Regular project
      (isMultiPage && pageCount > 0) // Multi-page discovery
    );
    
    console.log('useEffect analysis check:');
    console.log('- authLoading:', authLoading);
    console.log('- user:', !!user);
    console.log('- isInitialized:', isInitialized);
    console.log('- analysisStartedRef.current:', analysisStartedRef.current);
    console.log('- url:', url);
    console.log('- isProject:', isProject);
    console.log('- projectName:', projectName);
    console.log('- urls.length:', urls.length);
    console.log('- isMultiPage:', isMultiPage);
    console.log('- pageCount:', pageCount);
    console.log('- canStartAnalysis:', canStartAnalysis);
    
    if (!authLoading && user && !isInitialized && !analysisStartedRef.current && canStartAnalysis) {
      console.log('Starting analysis - all conditions met!');
      setIsInitialized(true);
      analysisStartedRef.current = true;
      startAnalysis();
    }
  }, [url, projectName, urls, isProject, isMultiPage, pageCount, isInitialized, authLoading, user, addToQueue]);

  // Handle completion and redirect
  const handleAnalysisComplete = useCallback((resultId: string) => {
    if (isProject || isMultiPage) {
      // For projects and multi-page inspections, we already have redirection logic in InspectionContext
      // The project redirection happens after saving the project to the database
      return;
    }
    
    // For single inspections, redirect to results page immediately
    if (resultId) {
      router.push(`/results/${resultId}`);
    } else {
      // If no specific result ID, try to find the completed inspection
      const completedInspection = currentQueueItems.find(item => item.status === 'completed');
      if (completedInspection?.backendId) {
        router.push(`/results/${completedInspection.backendId}`);
      } else {
        // Fallback to history page
        router.push('/history');
      }
    }
  }, [isProject, isMultiPage, router, currentQueueItems]);

  // Backup redirection mechanism - directly redirect when analysis completes
  useEffect(() => {
    if (analysisState.status === 'completed' && !isProject && !isMultiPage) {
      const timer = setTimeout(() => {
        if (analysisState.resultId) {
          router.push(`/results/${analysisState.resultId}`);
        } else {
          // Try to find completed inspection
          const completedInspection = currentQueueItems.find(item => item.status === 'completed');
          if (completedInspection?.backendId) {
            router.push(`/results/${completedInspection.backendId}`);
          } else {
            router.push('/history');
          }
        }
      }, 250); // Even faster backup redirection
      
      return () => clearTimeout(timer);
    }
  }, [analysisState.status, analysisState.resultId, isProject, isMultiPage, router, currentQueueItems]);

  // Show loading state while authentication is being checked
  if (authLoading) {
    return (
      <AnalysisProgressBar
        progress={0}
        status="pending"
        isProject={false}
      />
    );
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/');
    return null;
  }

  // Redirect back if no valid parameters
  if (!url && (!isProject || !projectName || urls.length === 0) && !isMultiPage) {
    router.push('/');
    return null;
  }

  // Get the first processing inspection for timing data
  const firstProcessingInspection = currentQueueItems.find(item => 
    item.status === 'processing'
  );

  return (
    <AnalysisProgressBar
      url={url || undefined}
      projectName={projectName || (isMultiPage ? `Website Analysis: ${url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname : ''}` : undefined)}
      progress={realProgress}
      status={analysisState.status}
      isProject={isProject || isMultiPage}
      onComplete={handleAnalysisComplete}
      resultId={analysisState.resultId || undefined}
      totalWebsites={(isProject || isMultiPage) ? totalWebsites : undefined}
      completedWebsites={(isProject || isMultiPage) ? completedWebsites : undefined}
      hasFailures={(isProject || isMultiPage) ? hasFailures : undefined}
      errorMessage={errorMessage}
      startTime={firstProcessingInspection?.startTime}
    />
  );
}

export default function AnalyzePage() {
  return (
    <AuthWrapper>
      <Suspense fallback={
        <AnalysisProgressBar
          progress={0}
          status="pending"
          isProject={false}
        />
      }>
        <AnalyzeContent />
      </Suspense>
    </AuthWrapper>
  );
} 