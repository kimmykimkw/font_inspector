"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableTable, ResizableHeader, ResizableCell } from "@/components/ui/resizable";
import { toast } from "sonner";
import { useInspection } from "@/contexts/InspectionContext";
import { generateFontInspectionCSV, downloadCSV } from '@/lib/csv-utils';
import { 
  findMatchingFontFile, 
  getCorrectFontFamily, 
  findAllMatchingFontFiles,
  type FontFile as MatchingFontFile,
  type ActiveFont as MatchingActiveFont,
  type FontFaceDeclaration as MatchingFontFaceDeclaration
} from '@/lib/font-matching';
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
import { useAuth } from "@/contexts/AuthContext";

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
  source?: string;
  metadata?: FontMetadata | null;
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

// Add these helper functions before the ResultsPage component
function generateConsistentColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate pastel colors for better visibility
  const h = hash % 360;
  return `hsl(${h}, 70%, 85%)`;
}

// Helper function to get full system font names
function getFullSystemFontName(fontFamily: string) {
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
}

// Font name normalization for grouping (simplified)
function normalizeFontName(fontFamily: string): string {
  // Remove common suffixes and clean up the name
  return fontFamily
    .replace(/\s+(Text|Headline|Display|Sans|Serif|Regular|Bold|Light|Medium)$/i, '')
    .replace(/["']/g, '')
    .trim();
}

// Normalize font family names for intelligent grouping (simplified)
function normalizeFontFamilyForGrouping(fontFamily: string): string {
  return normalizeFontName(fontFamily);
}

// Get correct font family name using simplified CSS @font-face matching
function getCorrectFontFamilyLocal(
  activeFont: ActiveFont, 
  downloadedFonts: FontFile[], 
  fontFaceDeclarations: any[]
): string {
  // Convert to matching types
  const matchingActiveFont = activeFont as MatchingActiveFont;
  const matchingDownloadedFonts = downloadedFonts.filter(font => font.source).map(font => ({
    ...font,
    source: font.source || 'Unknown'
  })) as MatchingFontFile[];
  const matchingFontFaceDeclarations = fontFaceDeclarations as MatchingFontFaceDeclaration[];
  
  // Use the new simplified matching logic
  const correctFamily = getCorrectFontFamily(matchingActiveFont, matchingDownloadedFonts, matchingFontFaceDeclarations);
  return normalizeFontFamilyForGrouping(correctFamily);
}

// Helper function to find matching downloaded font file using simplified logic
function findMatchingFontFileLocal(inspection: any, activeFont: ActiveFont): FontFile | null {
  if (!inspection.downloadedFonts?.length || !inspection.fontFaceDeclarations?.length) {
    return null;
  }
  
  // Convert to matching types
  const matchingActiveFont = activeFont as MatchingActiveFont;
  const matchingDownloadedFonts = inspection.downloadedFonts.filter((font: FontFile) => font.source).map((font: FontFile) => ({
    ...font,
    source: font.source || 'Unknown'
  })) as MatchingFontFile[];
  const matchingFontFaceDeclarations = inspection.fontFaceDeclarations as MatchingFontFaceDeclaration[];
  
  // Use the new simplified matching logic
  return findMatchingFontFile(
    matchingActiveFont, 
    matchingDownloadedFonts, 
    matchingFontFaceDeclarations
  );
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { getInspectionById } = useInspection();
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("fonts");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [selectedFontMetadata, setSelectedFontMetadata] = useState<any>(null);
  const [activeFontModalOpen, setActiveFontModalOpen] = useState(false);
  const [selectedActiveFontData, setSelectedActiveFontData] = useState<any>(null);

  // Group fonts by their file name - moved before any conditional returns
  const fontGroups = useMemo(() => {
    if (!inspection?.activeFonts) return {};
    
    const groups: { [key: string]: ActiveFont[] } = {};
    
    inspection.activeFonts.forEach((font: ActiveFont) => {
      const matchingFile = findMatchingFontFileLocal(inspection, font);
      if (matchingFile) {
        const key = matchingFile.name;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(font);
      }
    });
    
    return groups;
  }, [inspection?.activeFonts, inspection?.downloadedFonts]);

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
        setLoading(true);
        
        // First check if context data already has screenshots
        const contextInspection = getInspectionById(id);
        
        if (contextInspection?.result) {
          const normalizedContextData = normalizeInspectionData(contextInspection);
          
          // If context data has screenshots, use it directly (no need for API call)
          if (normalizedContextData?.screenshots) {
            console.log("Found inspection with screenshots in context, using directly");
            setInspection(normalizedContextData);
            setLoading(false);
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
        setLoading(false);
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
  if (loading) {
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
      setLoading(true);
      
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
      setLoading(false);
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

  // Update the reduce function with proper types
  const totalCount = inspection.activeFonts.reduce((sum: number, f: ActiveFont) => 
    sum + (f.elementCount || f.count || f.elements || 0), 0
  );

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
              {typeof inspection?.screenshots?.annotationCount === 'number' && (
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
                      {(inspection.downloadedFonts?.length > 0 || inspection.fontFaceDeclarations?.some((decl: any) => decl.isDynamic)) ? (
                        [...inspection.downloadedFonts, ...(inspection.fontFaceDeclarations?.filter((decl: any) => decl.isDynamic) || [])].map((font: FontFile | any, index: number) => {
                          // Check if this is a dynamic font declaration (like Adobe Fonts)
                          const isDynamicFont = font.isDynamic;
                          
                          // Helper function to find font family from CSS @font-face declarations
                          const findFontFamilyFromCSS = (fontUrl: string, metadata?: FontMetadata | null) => {
                            // PRIORITY 1: Use metadata font name (most accurate)
                            if (metadata?.fontName) {
                              return metadata.fontName;
                            }
                            
                            // PRIORITY 2: Try to match with active fonts (most reliable)
                            if (inspection.activeFonts?.length > 0) {
                              // Clean up the font filename for matching
                              const cleanFontName = font.name
                                .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '')
                                .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '')
                                .replace(/[-_]Variable.*$/i, '')
                                .replace(/[-_]\d+.*$/i, '')
                                .toLowerCase();

                              // First try exact match
                              const exactMatch = inspection.activeFonts.find((activeFont: ActiveFont) => {
                                const cleanActiveFontName = activeFont.family
                                  .toLowerCase()
                                  .replace(/["'\s]/g, '')
                                  .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '')
                                  .trim();
                                
                                return cleanFontName === cleanActiveFontName;
                              });

                              if (exactMatch) {
                                return exactMatch.family;
                              }

                              // If no exact match, try strict substring match
                              const substringMatch = inspection.activeFonts.find((activeFont: ActiveFont) => {
                                const cleanActiveFontName = activeFont.family
                                  .toLowerCase()
                                  .replace(/["'\s]/g, '')
                                  .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '')
                                  .trim();
                                
                                // Only match if the font name is a significant part of the active font name or vice versa
                                return (cleanFontName.length > 3 && cleanActiveFontName.includes(cleanFontName)) ||
                                       (cleanActiveFontName.length > 3 && cleanFontName.includes(cleanActiveFontName));
                              });

                              if (substringMatch) {
                                return substringMatch.family;
                              }
                            }
                            
                            // PRIORITY 3: Final fallback - use cleaned filename
                            const cleanName = font.name
                              .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '') // Remove extension
                              .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '') // Remove weight/style
                              .replace(/[-_]Variable.*$/i, '') // Remove Variable
                              .replace(/[-_]\d+.*$/i, '') // Remove numbers
                              .replace(/[-_]/g, ' ') // Convert separators to spaces
                              .trim();
                            
                            return cleanName || 'Unknown';
                          };

                          // Handle dynamic fonts differently
                          const fontFamily = isDynamicFont ? font.family : findFontFamilyFromCSS(font.url, font.metadata);
                          const fontName = isDynamicFont ? font.family : font.name;
                          const fontFormat = isDynamicFont ? 'Dynamic' : font.format;
                          const fontSize = isDynamicFont ? 'N/A' : `${(font.size / 1024).toFixed(2)} KB`;

                          return (
                            <tr key={index} className="border-b last:border-0 hover:bg-slate-50 transition-colors h-14">
                              <ResizableCell index={0} className="font-medium p-4 text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{fontFamily}</ResizableCell>
                              <ResizableCell index={1} className="p-4 text-slate-700 text-sm">{fontName}</ResizableCell>
                              <ResizableCell index={2} className="p-4 text-slate-700">{fontFormat}</ResizableCell>
                              <ResizableCell index={3} className="p-4 text-slate-700 tabular-nums">{fontSize}</ResizableCell>
                              <ResizableCell index={4} className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  (isDynamicFont && font.service === "Adobe Fonts") || font.source === "Adobe Fonts"
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : font.source === "Google Fonts" 
                                    ? "bg-blue-100 text-blue-800 border border-blue-200" 
                                    : font.source === "Self-hosted"
                                    ? "bg-green-100 text-green-800 border border-green-200"
                                    : font.source === "CDN"
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-gray-100 text-gray-800 border border-gray-200"
                                }`}>
                                  {isDynamicFont ? font.service || 'Dynamic Font Service' : font.source || 'Unknown'}
                                </span>
                              </ResizableCell>
                              <ResizableCell index={5} className="p-4">
                                {isDynamicFont ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                    Dynamic Font
                                  </span>
                                ) : font.metadata ? (
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
                                {isDynamicFont ? (
                                  <span className="text-gray-600 italic">
                                    Dynamic
                                  </span>
                                ) : (
                                  <a 
                                    href={font.url} 
                                    className="text-blue-600 hover:text-blue-800 hover:underline truncate inline-block max-w-full" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    title={font.url}
                                  >
                                    {font.url}
                                  </a>
                                )}
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
                {inspection.activeFonts?.length > 0 ? (() => {
                  // STEP 1: Create enhanced font groups using correct font family names
                  const enhancedFontGroups = inspection.activeFonts.reduce((groups: Record<string, ActiveFont[]>, font: ActiveFont) => {
                    const correctFontFamily = getCorrectFontFamilyLocal(font, inspection.downloadedFonts, inspection.fontFaceDeclarations);
                    if (!groups[correctFontFamily]) {
                      groups[correctFontFamily] = [];
                    }
                    groups[correctFontFamily].push(font);
                    return groups;
                  }, {});

                  // STEP 2: Render grouped fonts
                  return (
                    <div className="space-y-3">
                      {Object.entries(enhancedFontGroups).map(([groupFamily, groupFonts]) => {
                        // Calculate total elements for this group
                        const groupElementCount = groupFonts.reduce((sum, font) => 
                          sum + (font.elementCount || font.count || font.elements || 0), 0
                        );
                        const totalCount = inspection.activeFonts.reduce((sum: number, f: ActiveFont) => 
                          sum + (f.elementCount || f.count || f.elements || 0), 0
                        );
                        const percentage = totalCount > 0 ? (groupElementCount / totalCount) * 100 : 0;

                        // Find all matching font files for this group using simplified logic
                        const allMatchingFontFiles = groupFonts.flatMap(font => {
                          const matchingActiveFont = font as MatchingActiveFont;
                          const matchingDownloadedFonts = inspection.downloadedFonts.filter((f: FontFile) => f.source).map((f: FontFile) => ({
                            ...f,
                            source: f.source || 'Unknown'
                          })) as MatchingFontFile[];
                          const matchingFontFaceDeclarations = inspection.fontFaceDeclarations as MatchingFontFaceDeclaration[];
                          
                          return findAllMatchingFontFiles(matchingActiveFont, matchingDownloadedFonts, matchingFontFaceDeclarations);
                        });

                        // Remove duplicates
                        const uniqueMatchingFontFiles = Array.from(new Set(allMatchingFontFiles.map(f => f.url)))
                          .map(url => allMatchingFontFiles.find(f => f.url === url)!);

                        const fullSystemFontName = getFullSystemFontName(groupFamily);
                        const backgroundColor = uniqueMatchingFontFiles.length > 0
                          ? generateConsistentColor(uniqueMatchingFontFiles[0].name)
                          : 'bg-slate-50';

                        const isGrouped = groupFonts.length > 1;

                        // Find the CSS @font-face family name for this group
                        const getCssFontFaceName = () => {
                          if (!inspection.fontFaceDeclarations?.length) return null;
                          
                          // Try to find a matching @font-face declaration for any font in this group
                          for (const font of groupFonts) {
                            const cleanActiveFontName = font.family.toLowerCase().replace(/["']/g, '').trim();
                            const matchingDeclaration = inspection.fontFaceDeclarations.find(declaration => {
                              const cleanDeclarationFamily = declaration.family.toLowerCase().replace(/["']/g, '').trim();
                              return cleanDeclarationFamily === cleanActiveFontName;
                            });
                            
                            if (matchingDeclaration) {
                              return matchingDeclaration.family.replace(/["']/g, '').trim();
                            }
                          }
                          return null;
                        };

                        const cssFontFaceName = getCssFontFaceName();

                        // Find matching font-face declarations for this group
                        const matchingFontFaceDeclarations = inspection.fontFaceDeclarations?.filter((decl: any) => {
                          const cleanDeclarationFamily = decl.family.toLowerCase().replace(/["']/g, '').trim();
                          return groupFonts.some(font => {
                            const cleanActiveFontName = font.family.toLowerCase().replace(/["']/g, '').trim();
                            return cleanDeclarationFamily === cleanActiveFontName;
                          });
                        }) || [];

                        const handleActiveFontClick = () => {
                          setSelectedActiveFontData({
                            fontFamily: groupFamily,
                            elementCount: groupElementCount,
                            percentage: percentage,
                            matchingFontFiles: uniqueMatchingFontFiles,
                            matchingFontFaceDeclarations: matchingFontFaceDeclarations,
                            activeFonts: groupFonts
                          });
                          setActiveFontModalOpen(true);
                        };

                        return (
                          <div 
                            key={groupFamily} 
                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                              uniqueMatchingFontFiles.length > 0 ? 'hover:brightness-95' : 'hover:bg-slate-100'
                            }`}
                            style={{ backgroundColor: backgroundColor }}
                            onClick={handleActiveFontClick}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-semibold text-slate-800">
                                    {cssFontFaceName || groupFamily}
                                  </h3>
                                  {isGrouped && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-white/50 rounded-full border border-slate-200">
                                      Alias
                                    </span>
                                  )}
                                </div>
                                {uniqueMatchingFontFiles.length > 0 ? (
                                  <div className="space-y-1">
                                    {uniqueMatchingFontFiles.map((fontFile, idx) => (
                                      <p key={idx} className="text-sm text-slate-600 font-mono">{fontFile.name}</p>
                                    ))}
                                  </div>
                                ) : matchingFontFaceDeclarations.length > 0 && matchingFontFaceDeclarations.some((decl: any) => decl.isDynamic) ? (
                                  <p className="text-sm text-slate-500 italic">Dynamic font</p>
                                ) : (
                                  <p className="text-sm text-slate-500 italic">No matching font file</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <div className="w-24 bg-white/50 h-2 rounded-full overflow-hidden">
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
                                <div className="text-2xl font-bold text-slate-800 tabular-nums">{groupElementCount}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wide">elements</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })() : (
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

      {/* Active Font Details Modal */}
      <Dialog open={activeFontModalOpen} onOpenChange={setActiveFontModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Active Font Details
            </DialogTitle>
            <DialogDescription>
              Detailed information for font family: {selectedActiveFontData?.fontFamily}
            </DialogDescription>
          </DialogHeader>
          
          {selectedActiveFontData && (
            <div className="space-y-6 max-h-96 overflow-y-auto">
              {/* Font Family Overview */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">{selectedActiveFontData.fontFamily}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Elements using this font:</span>
                    <span className="ml-2 text-slate-900">{selectedActiveFontData.elementCount}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Usage percentage:</span>
                    <span className="ml-2 text-slate-900">{selectedActiveFontData.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Font Files */}
              {selectedActiveFontData.matchingFontFiles?.length > 0 ? (
                <div>
                  <h4 className="text-md font-semibold mb-3">Downloaded Font Files</h4>
                  <div className="space-y-4">
                    {selectedActiveFontData.matchingFontFiles.map((fontFile: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700">File Name</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border font-mono">
                              {fontFile.name}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Format</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                              {fontFile.format}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Size</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                              {(fontFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">Source</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                              {fontFile.source}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <label className="text-sm font-medium text-gray-700">URL</label>
                          <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded border font-mono break-all">
                            {fontFile.url}
                          </p>
                        </div>

                        {/* Font Metadata */}
                        {fontFile.metadata && (
                          <div className="mt-4 pt-4 border-t">
                            <h5 className="text-sm font-semibold mb-2">Font Metadata</h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {fontFile.metadata.fontName && (
                                <div>
                                  <span className="font-medium text-gray-700">Font Name:</span>
                                  <span className="ml-2 text-gray-900">{fontFile.metadata.fontName}</span>
                                </div>
                              )}
                              {fontFile.metadata.foundry && (
                                <div>
                                  <span className="font-medium text-gray-700">Foundry:</span>
                                  <span className="ml-2 text-gray-900">{fontFile.metadata.foundry}</span>
                                </div>
                              )}
                              {fontFile.metadata.version && (
                                <div>
                                  <span className="font-medium text-gray-700">Version:</span>
                                  <span className="ml-2 text-gray-900">{fontFile.metadata.version}</span>
                                </div>
                              )}
                              {fontFile.metadata.designer && (
                                <div>
                                  <span className="font-medium text-gray-700">Designer:</span>
                                  <span className="ml-2 text-gray-900">{fontFile.metadata.designer}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedActiveFontData.matchingFontFaceDeclarations?.length > 0 && selectedActiveFontData.matchingFontFaceDeclarations.some((decl: any) => decl.isDynamic) ? (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-md font-semibold mb-2 text-blue-800">Dynamic Font</h4>
                  <p className="text-sm text-blue-700">
                    This font is loaded dynamically from a font service (like Adobe Fonts or Google Fonts). 
                    The font files are served on-demand and don't appear as traditional downloaded files.
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="text-md font-semibold mb-2 text-yellow-800">No Font File Found</h4>
                  <p className="text-sm text-yellow-700">
                    This font family is being used on the page but no corresponding font file was downloaded. 
                    This typically indicates it's a system font or fallback font.
                  </p>
                </div>
              )}



              {/* Active Font Variants */}
              {selectedActiveFontData.activeFonts?.length > 1 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Font Variants</h4>
                  <div className="space-y-2">
                    {selectedActiveFontData.activeFonts.map((activeFont: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm font-mono">{activeFont.family}</span>
                        <span className="text-sm text-slate-600">{activeFont.elementCount} elements</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setActiveFontModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 