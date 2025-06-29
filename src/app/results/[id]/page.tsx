"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableTable, ResizableHeader, ResizableCell } from "@/components/ui/resizable";
import { toast } from "sonner";
import { useInspection } from "@/contexts/InspectionContext";
import { generateFontInspectionCSV, downloadCSV } from '@/lib/csv-utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  BarChart3, 
  Download, 
  Type, 
  Activity, 
  Globe, 
  Calendar, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileDown, 
  FolderOpen,
  Search,
  TrendingUp,
  Info,
  Camera
} from "lucide-react";
import { FontMetadata } from '@/lib/models/inspection';
import { ScreenshotViewer } from "@/components/ScreenshotViewer";

// Types for MongoDB inspection data
interface InspectionData {
  _id: string;
  url: string;
  timestamp: Date;
  downloadedFonts: FontFile[];
  activeFonts: ActiveFont[];
  fontFaceDeclarations: any[];
  createdAt?: Date;
  updatedAt?: Date;
  projectId?: string;
  screenshots?: {
    original: string;
    annotated: string;
    capturedAt: Date | string;
    dimensions?: {
      width: number;
      height: number;
    };
    annotationCount?: number;
  };
}

interface FontFile {
  name: string;
  format: string;
  size: number;
  url: string;
  source: string;
  metadata: any | null;
}

interface ActiveFont {
  family: string;
  count?: number;
  elements?: number;
  elementCount?: number;
  preview?: string;
}

// Helper function to format dates consistently
const formatDate = (dateString: string | Date): string => {
  if (!dateString) return '';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Helper to normalize different inspection data formats
const normalizeInspectionData = (data: any): InspectionData | null => {
  if (!data) return null;
  
  // Log the raw data to see what we're working with
  console.log("Normalizing inspection data:", data);
  console.log("Raw projectId from data:", data.projectId);
  
  // Handle different data structures
  if (data.result?.result) {
    // Context format (from InspectionContext)
    const result = data.result.result;
    
    // Process activeFonts to ensure they have elementCount
    const normalizedActiveFonts = (result.activeFonts || []).map((font: any) => ({
      ...font,
      // Make sure elementCount is present, even if it came as a different property
      elementCount: font.elementCount || font.count || 0
    }));
    
    // Extract projectId ensuring it's a string
    let projectId = data.projectId;
    if (projectId && typeof projectId === 'object') {
      // @ts-ignore - Try to get ID property if object
      projectId = projectId.id || projectId._id || null;
    }
    
    console.log("Normalized projectId from context:", projectId);
    
    return {
      _id: data.id,
      url: data.url,
      timestamp: data.completedAt || new Date(),
      downloadedFonts: result.downloadedFonts || [],
      activeFonts: normalizedActiveFonts,
      fontFaceDeclarations: result.fontFaceDeclarations || [],
      createdAt: data.createdAt,
      projectId: projectId,
      screenshots: result.screenshots || undefined
    };
  } else if (data.downloadedFonts) {
    // MongoDB format (from API)
    // Process activeFonts to ensure they have elementCount
    const normalizedActiveFonts = (data.activeFonts || []).map((font: any) => ({
      ...font,
      // Make sure elementCount is present, even if it came as a different property
      elementCount: font.elementCount || font.count || 0
    }));
    
    // Extract projectId ensuring it's a string
    let projectId = data.projectId;
    if (projectId && typeof projectId === 'object') {
      // @ts-ignore - Try to get ID property if object
      projectId = projectId.id || projectId._id || null;
    }
    
    console.log("Normalized projectId from API:", projectId);
    
    return {
      ...data,
      activeFonts: normalizedActiveFonts,
      projectId: projectId,
      screenshots: data.screenshots || undefined
    };
  }
  
  return null;
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { getInspectionById } = useInspection();
  const [activeTab, setActiveTab] = useState("fonts");
  const [isLoading, setIsLoading] = useState(true);
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [selectedFontMetadata, setSelectedFontMetadata] = useState<any>(null);
  
  // Get inspection ID from params
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  
  // Fetch inspection data from both sources
  useEffect(() => {
    const fetchInspectionData = async () => {
      if (!id) {
        router.push('/history');
        return;
      }
      
      try {
        setIsLoading(true);
        
        // First check if context data already has screenshots
        const contextInspection = getInspectionById(id);
        
        if (contextInspection?.result) {
          const normalizedContextData = normalizeInspectionData(contextInspection);
          
          // If context data has screenshots, use it directly (no need for API call)
          if (normalizedContextData?.screenshots) {
            console.log("Found inspection with screenshots in context, using directly");
            setInspection(normalizedContextData);
            setIsLoading(false);
            return;
          }
        }
        
        // Only fetch from API if screenshots are missing or no context data exists
        console.log("Screenshots missing or no context data, fetching from API...");
        
        // Get authentication token for API request
        const { auth } = await import('@/lib/firebase-client');
        const user = auth?.currentUser;
        let headers: HeadersInit = {};
        
        if (user) {
          try {
            const idToken = await user.getIdToken();
            headers = {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            };
          } catch (tokenError) {
            console.warn('Failed to get ID token:', tokenError);
          }
        }
        
        const response = await fetch(`/api/results/${id}`, { headers });
        
        // Handle error responses
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to load inspection (${response.status})`);
        }
        
        // Parse successful response
        const data = await response.json();
        console.log("Inspection data from API:", data);
        console.log("Inspection projectId from API:", data.projectId);
        
        // Debug the project ID more thoroughly
        if (data.projectId) {
          console.log("API ProjectId type:", typeof data.projectId);
          if (typeof data.projectId === 'object') {
            console.log("ProjectId is an object in API response:", JSON.stringify(data.projectId));
          }
          
          // Try to verify the project exists
          try {
            const projectResponse = await fetch(`/api/projects/${data.projectId}`, { headers });
            console.log("Project API status:", projectResponse.status);
            if (projectResponse.ok) {
              const projectData = await projectResponse.json();
              console.log("Project data found:", projectData);
            } else {
              console.log("Project not found with this ID");
            }
          } catch (err) {
            console.error("Error checking project:", err);
          }
        } else {
          console.log("No projectId found in API response");
        }
        
        // Set normalized data
        const normalizedData = normalizeInspectionData(data);
        setInspection(normalizedData);
      } catch (error) {
        console.error("Error fetching inspection from API:", error);
        
        // Fallback to InspectionContext if API fails
        console.log("Attempting to fallback to InspectionContext...");
        const contextInspection = getInspectionById(id);
        
        if (contextInspection?.result) {
          console.log("Found inspection in context as fallback:", contextInspection);
          const normalizedData = normalizeInspectionData(contextInspection);
          setInspection(normalizedData);
          toast.info("Loaded inspection from cache (screenshots may not be available)");
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          setError(errorMessage);
          toast.error("Failed to load inspection");
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInspectionData();
  }, [id, router, getInspectionById]);

  // Debug inspection data for Active Fonts
  useEffect(() => {
    if (inspection) {
      console.log('🔍 Active Fonts Debug:', {
        activeFontsCount: inspection.activeFonts?.length || 0,
        activeFonts: inspection.activeFonts?.map(f => f.family) || [],
        downloadedFontsCount: inspection.downloadedFonts?.length || 0,
        downloadedFonts: inspection.downloadedFonts?.map(f => f.name) || []
      });
    }
  }, [inspection]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading inspection data...</CardTitle>
            <CardDescription>
              Please wait while we retrieve the results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show error state
  if (error || !inspection) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading Inspection</CardTitle>
            <CardDescription className="text-red-700">
              {error || "Could not find the requested inspection"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/history')}
              className="mt-2"
            >
              Back to History
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare data for displaying
  const summary = {
    totalFonts: inspection.downloadedFonts?.length || 0,
    activeCount: inspection.activeFonts?.length || 0,
    allFonts: (inspection.activeFonts || []).map((font: ActiveFont) => ({
      name: font.family,
      count: font.elementCount || font.count || 0 // First try elementCount, then count
    })).sort((a, b) => b.count - a.count)
  };

  // Back to project navigation handler
  const handleBackToProject = async () => {
    console.log("ProjectId from inspection:", inspection.projectId);
    console.log("ProjectId type:", typeof inspection.projectId);
    console.log("Inspection ID:", inspection._id);
    
    // First check standard projectId
    if (inspection.projectId && 
        typeof inspection.projectId === 'string' && 
        !inspection.projectId.startsWith('proj_')) {
      
      console.log("Using stored projectId:", inspection.projectId);
      router.push(`/project/${inspection.projectId}`);
      return;
    }
    
    // If we have a client-side ID or no project ID, try to find the real project
    try {
      console.log("Trying to find actual project for inspection:", inspection._id);
      
      // Get authentication token for API request
      const { auth } = await import('@/lib/firebase-client');
      const user = auth?.currentUser;
      let headers: HeadersInit = {};
      
      if (user) {
        try {
          const idToken = await user.getIdToken();
          headers = {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          };
        } catch (tokenError) {
          console.warn('Failed to get ID token:', tokenError);
        }
      }
      
      // Fetch all projects to find which one contains this inspection
      const projectsResponse = await fetch('/api/projects', { headers });
      if (!projectsResponse.ok) {
        throw new Error("Failed to fetch projects");
      }
      
      const projects = await projectsResponse.json();
      console.log(`Found ${projects.length} projects to check`);
      
      // Look for a project that includes this inspection
      for (const project of projects) {
        console.log(`Checking project ${project._id}: ${project.name}`);
        
        // Check if this inspection is in the project's inspections list
        const isInProject = project.inspections?.some(
          (insp: any) => insp._id === inspection._id
        );
        
        if (isInProject) {
          console.log(`Found inspection in project ${project._id}`);
          router.push(`/project/${project._id}`);
          return;
        }
      }
      
      // If we get here, the inspection is not in any project
      console.log("Inspection not found in any project");
      toast.info("This inspection is not associated with any project in the database.");
      router.push('/history');
    } catch (error) {
      console.error("Error finding project:", error);
      toast.error("Failed to find project information. Redirecting to history.");
      router.push('/history');
    }
  };

  // Handle inspection deletion
  const handleDeleteInspection = async () => {
    if (!inspection || !inspection._id) {
      toast.error("Cannot delete: inspection ID is missing");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get authentication token for API request
      const { auth } = await import('@/lib/firebase-client');
      const user = auth?.currentUser;
      let headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (user) {
        try {
          const idToken = await user.getIdToken();
          headers = {
            ...headers,
            'Authorization': `Bearer ${idToken}`,
          };
        } catch (tokenError) {
          console.warn('Failed to get ID token:', tokenError);
          throw new Error('Authentication required');
        }
      } else {
        throw new Error('Authentication required');
      }
      
      // Call API to delete inspection
      const response = await fetch(`/api/results/${inspection._id}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete inspection (${response.status})`);
      }
      
      // Show success message
      toast.success("Inspection deleted successfully");
      
      // Redirect to history page
      router.push('/history');
    } catch (error) {
      console.error("Error deleting inspection:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete inspection: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  // Handle export results to CSV
  const handleExportResults = () => {
    if (!inspection) {
      console.error('🔍 CSV Export Error: No inspection data available');
      return;
    }

    console.log('🔍 Starting CSV export for inspection results page:', inspection._id);
    console.log('🔍 Inspection data structure:', {
      id: inspection._id,
      url: inspection.url,
      hasDownloadedFonts: !!inspection.downloadedFonts,
      downloadedFontsCount: inspection.downloadedFonts?.length || 0,
      hasFontFaceDeclarations: !!inspection.fontFaceDeclarations,
      fontFaceDeclarationsCount: inspection.fontFaceDeclarations?.length || 0,
      hasActiveFonts: !!inspection.activeFonts,
      activeFontsCount: inspection.activeFonts?.length || 0
    });

    // Transform the inspection data to match the expected format for our CSV utility
    const transformedInspection = {
      id: inspection._id,
      url: inspection.url,
      result: {
        result: {
          downloadedFonts: inspection.downloadedFonts || [],
          fontFaceDeclarations: inspection.fontFaceDeclarations || [],
          activeFonts: inspection.activeFonts || []
        }
      }
    };

    // Use the enhanced CSV generation utility
    const csvContent = generateFontInspectionCSV(transformedInspection, `Results Page ${inspection._id} CSV Export`);
    
    if (!csvContent) {
      console.error('❌ Failed to generate CSV content');
      toast.error("Failed to export results");
      return;
    }

    // Generate filename
    const filename = `font-inspection-${inspection.url.replace(/[^a-z0-9]/gi, '-')}.csv`;
    
    // Download the CSV
    downloadCSV(csvContent, filename);
    
    console.log('✅ CSV export completed for results page:', inspection._id);
    toast.success("Results exported successfully!");
  };

  const handleViewMetadata = (font: FontFile) => {
    setSelectedFontMetadata({ font, metadata: font.metadata });
    setMetadataModalOpen(true);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-neutral-700" />
            <h1 className="text-3xl font-bold">Inspection Results</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {inspection?.projectId && (
              <Button 
                variant="outline" 
                onClick={handleBackToProject}
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Back to Project
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => router.push('/history')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to History
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Inspection
            </Button>
            {/* Only show delete button if inspection is NOT part of a project */}
            {!inspection?.projectId && (
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <Button onClick={handleExportResults} className="flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              Export Results
            </Button>
          </div>
        </div>

        {/* Inspection Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {inspection.url}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Inspected on {formatDate(inspection.timestamp || inspection.createdAt || new Date())}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tabs for Results Sections */}
        <Tabs defaultValue="fonts" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="fonts" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Downloaded Fonts
              {summary.totalFonts > 0 && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                  {summary.totalFonts}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Active Fonts
              {summary.activeCount > 0 && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                  {summary.activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="screenshots" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Screenshots
              {inspection?.screenshots?.annotationCount && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                  {inspection.screenshots.annotationCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Screenshots Tab */}
          <TabsContent value="screenshots">
            <ScreenshotViewer 
              inspectionId={inspection._id}
              screenshots={inspection.screenshots}
              url={inspection.url}
            />
          </TabsContent>

          {/* Downloaded Fonts Tab */}
          <TabsContent value="fonts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Font Download Details
                </CardTitle>
                <CardDescription>Files downloaded by the website</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-x-auto shadow-sm">
                  <ResizableTable columnCount={7} className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b h-14">
                        <ResizableHeader index={0} className="font-semibold p-4 text-slate-700">Font Family</ResizableHeader>
                        <ResizableHeader index={1} className="font-semibold p-4 text-slate-700">Font Name</ResizableHeader>
                        <ResizableHeader index={2} className="font-semibold p-4 text-slate-700">Format</ResizableHeader>
                        <ResizableHeader index={3} className="font-semibold p-4 text-slate-700">Size</ResizableHeader>
                        <ResizableHeader index={4} className="font-semibold p-4 text-slate-700">Source</ResizableHeader>
                        <ResizableHeader index={5} className="font-semibold p-4 text-slate-700">Metadata</ResizableHeader>
                        <ResizableHeader index={6} className="font-semibold p-4 text-slate-700">URL</ResizableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {inspection.downloadedFonts?.length > 0 ? (
                        inspection.downloadedFonts.map((font: FontFile, index: number) => {
                          // Helper function to find font family from CSS @font-face declarations
                          const findFontFamilyFromCSS = (fontUrl: string, metadata?: FontMetadata | null) => {
                            // PRIORITY 1: Use metadata font name (most accurate)
                            if (metadata?.fontName) {
                              return metadata.fontName;
                            }
                            
                            // PRIORITY 2: Try to match with active fonts (most reliable)
                            if (inspection.activeFonts?.length > 0) {
                              // Extract basic name from filename for matching
                              const basicName = font.name
                                .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '')
                                .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '')
                                .replace(/[-_]Variable.*$/i, '')
                                .replace(/[-_]\d+.*$/i, '')
                                .replace(/[-_]/g, '')
                                .trim()
                                .toLowerCase();
                              
                              const matchingActiveFont = inspection.activeFonts.find((activeFont: ActiveFont) => {
                                const activeFontName = activeFont.family.toLowerCase().replace(/["'\s]/g, '').trim();
                                const fontFileName = font.name.toLowerCase().replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '');
                                
                                console.log(`🎯 Comparing "${activeFontName}" with "${fontFileName}"`);
                                console.log(`🎯 Full font file name: "${font.name}"`);
                                console.log(`🎯 Font file URL: "${font.url}"`);
                                console.log(`🎯 Font metadata name: "${font.metadata?.fontName || 'none'}"`);
                                
                                // Multiple matching strategies
                                const metadataMatch = font.metadata?.fontName && 
                                  font.metadata.fontName.toLowerCase().replace(/["'\s]/g, '').trim() === activeFontName;
                                const directMatch = activeFontName === fontFileName;
                                const filenameContainsFamily = fontFileName.includes(activeFontName);
                                const familyContainsFilename = activeFontName.includes(fontFileName);
                                const noHyphensMatch = fontFileName.replace(/[-_]/g, '').includes(activeFontName.replace(/[-_]/g, ''));
                                const partialWordMatch = fontFileName.includes(activeFontName.split(' ')[0].toLowerCase());
                                const filenameWordMatch = activeFontName.includes(fontFileName.split(/[-_]/)[0]);
                                
                                // Enhanced metadata matching for "Aktiv Grotesk" case
                                const metadataWords = font.metadata?.fontName ? 
                                  font.metadata.fontName.toLowerCase().replace(/["'\s]/g, '').replace(/[^a-z]/g, '') : '';
                                const activeFontWords = activeFontName.replace(/[-_]/g, '').replace(/[^a-z]/g, '');
                                
                                // Multiple strategies for metadata matching
                                const metadataExactMatch = metadataWords === activeFontWords;
                                const metadataContainsActive = metadataWords.includes(activeFontWords);
                                const activeContainsMetadata = activeFontWords.includes(metadataWords);
                                
                                // New: Check for common word prefixes (like "aktivgrotesk")
                                const findCommonPrefix = (str1: string, str2: string) => {
                                  let i = 0;
                                  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
                                    i++;
                                  }
                                  return str1.substring(0, i);
                                };
                                
                                const commonPrefix = findCommonPrefix(metadataWords, activeFontWords);
                                const hasSignificantCommonPrefix = commonPrefix.length >= 8; // At least 8 characters in common
                                
                                // Alternative: Split into words and check for overlap
                                const metadataWordParts = font.metadata?.fontName ? 
                                  font.metadata.fontName.toLowerCase().split(/[\s-_]+/).filter((w: string) => w.length > 2) : [];
                                const activeFontWordParts = activeFontName.split(/[\s-_]+/).filter((w: string) => w.length > 2);
                                
                                const hasCommonWords = metadataWordParts.some((metaPart: string) => 
                                  activeFontWordParts.some((activePart: string) => 
                                    metaPart.includes(activePart) || activePart.includes(metaPart)
                                  )
                                );
                                
                                const metadataPartialMatch = metadataExactMatch || metadataContainsActive || activeContainsMetadata || hasSignificantCommonPrefix || hasCommonWords;
                                
                                console.log(`🎯 Match results:`, JSON.stringify({
                                  metadataMatch: metadataMatch,
                                  directMatch: directMatch,
                                  filenameContainsFamily: filenameContainsFamily,
                                  familyContainsFilename: familyContainsFilename,
                                  noHyphensMatch: noHyphensMatch,
                                  partialWordMatch: partialWordMatch,
                                  filenameWordMatch: filenameWordMatch,
                                  metadataPartialMatch: metadataPartialMatch,
                                  metadataWords: metadataWords,
                                  activeFontWords: activeFontWords,
                                  // New detailed metadata matching
                                  metadataExactMatch: metadataExactMatch,
                                  metadataContainsActive: metadataContainsActive,
                                  activeContainsMetadata: activeContainsMetadata,
                                  commonPrefix: commonPrefix,
                                  hasSignificantCommonPrefix: hasSignificantCommonPrefix,
                                  metadataWordParts: metadataWordParts,
                                  activeFontWordParts: activeFontWordParts,
                                  hasCommonWords: hasCommonWords
                                }, null, 2));
                                
                                // Special debugging for the Aktiv Grotesk case
                                if (font.metadata?.fontName?.includes('Aktiv') || activeFontName.includes('aktiv')) {
                                  console.log(`🚨 AKTIV GROTESK SPECIAL DEBUG:`, {
                                    activeFont: activeFontName,
                                    metadataName: font.metadata?.fontName,
                                    metadataWords: metadataWords,
                                    activeFontWords: activeFontWords,
                                    shouldMatch: metadataPartialMatch
                                  });
                                }
                                
                                return (
                                  metadataMatch ||
                                  directMatch ||
                                  filenameContainsFamily ||
                                  familyContainsFilename ||
                                  noHyphensMatch ||
                                  partialWordMatch ||
                                  filenameWordMatch ||
                                  metadataPartialMatch
                                );
                              });
                              
                              if (matchingActiveFont) {
                                return matchingActiveFont.family.replace(/["']/g, '').trim();
                              }
                            }
                            
                            // PRIORITY 3: Try CSS @font-face declarations
                            if (inspection.fontFaceDeclarations?.length > 0) {
                              for (const declaration of inspection.fontFaceDeclarations) {
                                if (declaration.source && declaration.family) {
                                  // Check if the font URL is referenced in the @font-face source
                                  const sourceUrls = declaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
                                  
                                  if (sourceUrls) {
                                    for (const sourceUrl of sourceUrls) {
                                      // Extract the actual URL from url() declaration
                                      const urlMatch = sourceUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
                                      if (urlMatch && urlMatch[1]) {
                                        const cssUrl = urlMatch[1];
                                        
                                        // Check if the font URL matches or ends with the CSS URL
                                        if (fontUrl === cssUrl || 
                                            fontUrl.endsWith(cssUrl) || 
                                            cssUrl.endsWith(fontUrl.split('/').pop() || '') ||
                                            fontUrl.includes(cssUrl.split('/').pop() || '')) {
                                          return declaration.family.replace(/["']/g, '').trim();
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                            
                            // PRIORITY 4: Final fallback - extract from filename with better logic
                            const cleanName = font.name
                              .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '') // Remove extension
                              .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '') // Remove weight/style
                              .replace(/[-_]Variable.*$/i, '') // Remove Variable
                              .replace(/[-_]\d+.*$/i, '') // Remove numbers
                              .replace(/[-_]/g, ' ') // Convert separators to spaces
                              .trim();
                            
                            return cleanName || 'Unknown';
                          };

                          const fontFamily = findFontFamilyFromCSS(font.url, font.metadata);

                          return (
                            <tr key={index} className="border-b last:border-0 hover:bg-slate-50 transition-colors h-14">
                              <ResizableCell index={0} className="font-medium p-4 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{fontFamily}</ResizableCell>
                              <ResizableCell index={1} className="p-4 text-slate-700 text-sm">{font.name}</ResizableCell>
                              <ResizableCell index={2} className="p-4 text-slate-700">{font.format}</ResizableCell>
                              <ResizableCell index={3} className="p-4 text-slate-700 tabular-nums">{(font.size / 1024).toFixed(2)} KB</ResizableCell>
                              <ResizableCell index={4} className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  font.source === "Google Fonts" 
                                    ? "bg-blue-100 text-blue-800 border border-blue-200" 
                                    : font.source === "Adobe Fonts"
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : font.source === "Self-hosted"
                                    ? "bg-green-100 text-green-800 border border-green-200"
                                    : font.source === "CDN"
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-gray-100 text-gray-800 border border-gray-200"
                                }`}>
                                  {font.source || 'Unknown'}
                                </span>
                              </ResizableCell>
                              <ResizableCell index={5} className="p-4">
                                {font.metadata ? (
                                  <button
                                    onClick={() => handleViewMetadata(font)}
                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors cursor-pointer"
                                  >
                                    <Info className="h-3 w-3 mr-1" />
                                    Available
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                    Not Extracted
                                  </span>
                                )}
                              </ResizableCell>
                              <ResizableCell index={6} className="p-4 text-xs">
                                <a 
                                  href={font.url} 
                                  className="text-blue-600 hover:text-blue-800 hover:underline truncate inline-block max-w-full" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  title={font.url}
                                >
                                  {font.url}
                                </a>
                              </ResizableCell>
                            </tr>
                          );
                        })
                      ) : (
                        <tr className="h-14">
                          <td colSpan={7} className="p-6 text-center text-gray-500">
                            No downloaded fonts detected
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </ResizableTable>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Fonts Tab */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Active Fonts
                </CardTitle>
                <CardDescription>Fonts actively used on the page</CardDescription>
              </CardHeader>
              <CardContent>
                {inspection.activeFonts?.length > 0 ? (
                  <div className="space-y-3">
                    {inspection.activeFonts.map((font: ActiveFont, index: number) => {
                      const elementCount = font.elementCount || font.count || font.elements || 0;
                      const totalCount = inspection.activeFonts.reduce((sum, f) => sum + (f.elementCount || f.count || f.elements || 0), 0);
                      const percentage = totalCount > 0 ? (elementCount / totalCount) * 100 : 0;
                      
                      // Helper function to find matching downloaded font file
                      const findMatchingFontFile = (activeFont: ActiveFont) => {
                        console.log('🔍 Debugging font matching for:', activeFont.family);
                        console.log('📁 Available downloaded fonts:', inspection.downloadedFonts?.length || 0);
                        console.log('📁 Downloaded fonts list:', inspection.downloadedFonts?.map(f => f.name) || []);
                        
                        if (!inspection.downloadedFonts?.length) {
                          console.log('❌ No downloaded fonts available');
                          return null;
                        }
                        
                        // Try to find a downloaded font that matches this active font
                        const matchingFont = inspection.downloadedFonts.find((downloadedFont: FontFile) => {
                          const activeFontName = activeFont.family.toLowerCase().replace(/["'\s]/g, '').trim();
                          
                          // Enhanced filename extraction
                          let fontFileName = '';
                          
                          // Try to extract filename from URL if name is not a proper filename
                          if (downloadedFont.name && downloadedFont.name.length > 5) {
                            // Use the name as-is if it looks like a proper filename
                            fontFileName = downloadedFont.name.toLowerCase().replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '');
                          } else if (downloadedFont.url) {
                            // Extract filename from URL
                            const urlParts = downloadedFont.url.split('/');
                            const filename = urlParts[urlParts.length - 1] || '';
                            fontFileName = filename.toLowerCase().replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '');
                          } else {
                            fontFileName = downloadedFont.name || '';
                          }
                          
                          console.log(`🔧 Font processing:`, JSON.stringify({
                            originalName: downloadedFont.name,
                            url: downloadedFont.url,
                            extractedFileName: fontFileName,
                            nameLength: downloadedFont.name?.length || 0
                          }, null, 2));
                          
                          console.log(`🎯 Comparing "${activeFontName}" with "${fontFileName}"`);
                          console.log(`🎯 Full font file name: "${downloadedFont.name}"`);
                          console.log(`🎯 Font file URL: "${downloadedFont.url}"`);
                          console.log(`🎯 Font metadata name: "${downloadedFont.metadata?.fontName || 'none'}"`);
                          
                          // Multiple matching strategies
                          const metadataMatch = downloadedFont.metadata?.fontName && 
                            downloadedFont.metadata.fontName.toLowerCase().replace(/["'\s]/g, '').trim() === activeFontName;
                          const directMatch = activeFontName === fontFileName;
                          const filenameContainsFamily = fontFileName.includes(activeFontName);
                          const familyContainsFilename = activeFontName.includes(fontFileName);
                          const noHyphensMatch = fontFileName.replace(/[-_]/g, '').includes(activeFontName.replace(/[-_]/g, ''));
                          const partialWordMatch = fontFileName.includes(activeFontName.split(' ')[0].toLowerCase());
                          const filenameWordMatch = activeFontName.includes(fontFileName.split(/[-_]/)[0]);
                          
                          // Enhanced metadata matching for "Aktiv Grotesk" case
                          const metadataWords = downloadedFont.metadata?.fontName ? 
                            downloadedFont.metadata.fontName.toLowerCase().replace(/["'\s]/g, '').replace(/[^a-z]/g, '') : '';
                          const activeFontWords = activeFontName.replace(/[-_]/g, '').replace(/[^a-z]/g, '');
                          
                          // Multiple strategies for metadata matching
                          const metadataExactMatch = metadataWords === activeFontWords;
                          const metadataContainsActive = metadataWords.includes(activeFontWords);
                          const activeContainsMetadata = activeFontWords.includes(metadataWords);
                          
                          // New: Check for common word prefixes (like "aktivgrotesk")
                          const findCommonPrefix = (str1: string, str2: string) => {
                            let i = 0;
                            while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
                              i++;
                            }
                            return str1.substring(0, i);
                          };
                          
                          const commonPrefix = findCommonPrefix(metadataWords, activeFontWords);
                          const hasSignificantCommonPrefix = commonPrefix.length >= 8; // At least 8 characters in common
                          
                          // Alternative: Split into words and check for overlap
                          const metadataWordParts = downloadedFont.metadata?.fontName ? 
                            downloadedFont.metadata.fontName.toLowerCase().split(/[\s-_]+/).filter((w: string) => w.length > 2) : [];
                          const activeFontWordParts = activeFontName.split(/[\s-_]+/).filter((w: string) => w.length > 2);
                          
                          const hasCommonWords = metadataWordParts.some((metaPart: string) => 
                            activeFontWordParts.some((activePart: string) => 
                              metaPart.includes(activePart) || activePart.includes(metaPart)
                            )
                          );
                          
                          const metadataPartialMatch = metadataExactMatch || metadataContainsActive || activeContainsMetadata || hasSignificantCommonPrefix || hasCommonWords;
                          
                          console.log(`🎯 Match results:`, JSON.stringify({
                            metadataMatch: metadataMatch,
                            directMatch: directMatch,
                            filenameContainsFamily: filenameContainsFamily,
                            familyContainsFilename: familyContainsFilename,
                            noHyphensMatch: noHyphensMatch,
                            partialWordMatch: partialWordMatch,
                            filenameWordMatch: filenameWordMatch,
                            metadataPartialMatch: metadataPartialMatch,
                            metadataWords: metadataWords,
                            activeFontWords: activeFontWords,
                            // New detailed metadata matching
                            metadataExactMatch: metadataExactMatch,
                            metadataContainsActive: metadataContainsActive,
                            activeContainsMetadata: activeContainsMetadata,
                            commonPrefix: commonPrefix,
                            hasSignificantCommonPrefix: hasSignificantCommonPrefix,
                            metadataWordParts: metadataWordParts,
                            activeFontWordParts: activeFontWordParts,
                            hasCommonWords: hasCommonWords
                          }, null, 2));
                          
                          // Special debugging for the Aktiv Grotesk case
                          if (downloadedFont.metadata?.fontName?.includes('Aktiv') || activeFontName.includes('aktiv')) {
                            console.log(`🚨 AKTIV GROTESK SPECIAL DEBUG:`, {
                              activeFont: activeFontName,
                              metadataName: downloadedFont.metadata?.fontName,
                              metadataWords: metadataWords,
                              activeFontWords: activeFontWords,
                              shouldMatch: metadataPartialMatch
                            });
                          }
                          
                          return (
                            metadataMatch ||
                            directMatch ||
                            filenameContainsFamily ||
                            familyContainsFilename ||
                            noHyphensMatch ||
                            partialWordMatch ||
                            filenameWordMatch ||
                            metadataPartialMatch
                          );
                        });
                        
                        console.log('✅ Found matching font:', matchingFont?.name || 'none');
                        return matchingFont;
                      };
                      
                      const matchingFontFile = findMatchingFontFile(font);
                      
                      // Helper function to get full system font names
                      const getFullSystemFontName = (fontFamily: string) => {
                        const systemFontMap: Record<string, string> = {
                          'Times': 'Times New Roman',
                          'times': 'Times New Roman',
                          'Helvetica': 'Helvetica',
                          'Arial': 'Arial',
                          'Courier': 'Courier New',
                          'courier': 'Courier New',
                          'Georgia': 'Georgia',
                          'Verdana': 'Verdana',
                          'Tahoma': 'Tahoma',
                          'Impact': 'Impact',
                          'Comic Sans MS': 'Comic Sans MS',
                          'Trebuchet MS': 'Trebuchet MS'
                        };
                        
                        return systemFontMap[fontFamily] || fontFamily;
                      };
                      
                      const fullSystemFontName = getFullSystemFontName(font.family);
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <div className="flex flex-col">
                              <h3 className="text-lg font-semibold text-slate-800">{font.family}</h3>
                              {matchingFontFile && (
                                <p className="text-sm text-slate-600 font-mono">{matchingFontFile.name}</p>
                              )}
                              {!matchingFontFile && (
                                <p className="text-sm text-slate-500 italic">System font - {fullSystemFontName}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-primary h-full rounded-full transition-all duration-300" 
                                  style={{ width: `${Math.max(8, percentage)}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-600 min-w-fit">
                                {percentage.toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-slate-800 tabular-nums">{elementCount}</div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide">elements</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <div className="text-4xl mb-2">📝</div>
                    <div className="text-lg font-medium mb-1">No active fonts detected</div>
                    <div className="text-sm text-slate-400">The page might not be using any custom fonts</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Delete Confirmation Dialog - Only show if inspection is NOT part of a project */}
      {!inspection?.projectId && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Inspection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this inspection? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteInspection}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Font Metadata Modal */}
      <Dialog open={metadataModalOpen} onOpenChange={setMetadataModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Font Metadata Details
            </DialogTitle>
            <DialogDescription>
              Detailed metadata information for {selectedFontMetadata?.font?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedFontMetadata?.metadata && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Font Name</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                    {selectedFontMetadata.metadata.fontName || 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Foundry</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                    {selectedFontMetadata.metadata.foundry || 'Not available'}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Copyright</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                  {selectedFontMetadata.metadata.copyright || 'Not available'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Version</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                    {selectedFontMetadata.metadata.version || 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Designer</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                    {selectedFontMetadata.metadata.designer || 'Not available'}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">License Information</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                  {selectedFontMetadata.metadata.licenseInfo || 'Not available'}
                </p>
              </div>
              
              {selectedFontMetadata.metadata.embeddingPermissions && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Embedding Permissions</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className={`p-2 rounded text-xs font-medium ${
                      selectedFontMetadata.metadata.embeddingPermissions.installable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      Installable: {selectedFontMetadata.metadata.embeddingPermissions.installable ? 'Yes' : 'No'}
                    </div>
                    <div className={`p-2 rounded text-xs font-medium ${
                      selectedFontMetadata.metadata.embeddingPermissions.editable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      Editable: {selectedFontMetadata.metadata.embeddingPermissions.editable ? 'Yes' : 'No'}
                    </div>
                    <div className={`p-2 rounded text-xs font-medium ${
                      selectedFontMetadata.metadata.embeddingPermissions.previewAndPrint 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      Preview & Print: {selectedFontMetadata.metadata.embeddingPermissions.previewAndPrint ? 'Yes' : 'No'}
                    </div>
                    <div className={`p-2 rounded text-xs font-medium ${
                      selectedFontMetadata.metadata.embeddingPermissions.restrictedLicense 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      Restricted: {selectedFontMetadata.metadata.embeddingPermissions.restrictedLicense ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Unique Identifier</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border font-mono">
                    {selectedFontMetadata.metadata.uniqueIdentifier || 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Creation Date</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                    {selectedFontMetadata.metadata.creationDate 
                      ? new Date(selectedFontMetadata.metadata.creationDate).toLocaleDateString()
                      : 'Not available'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setMetadataModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 