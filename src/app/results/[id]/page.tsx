"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableTable, ResizableHeader, ResizableCell } from "@/components/ui/resizable";
import { toast } from "sonner";
import { useInspection } from "@/contexts/InspectionContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  TrendingUp
} from "lucide-react";

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
}

interface FontFile {
  name: string;
  format: string;
  size: number;
  url: string;
  source: string;
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
      projectId: projectId
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
      projectId: projectId
    };
  }
  
  return null;
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { getInspectionById } = useInspection();
  const [activeTab, setActiveTab] = useState("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
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
        
        // First check if this is a recent inspection in memory (from InspectionContext)
        const contextInspection = getInspectionById(id);
        
        if (contextInspection?.result) {
          // We have it in context, use it directly
          console.log("Found inspection in context:", contextInspection);
          console.log("Inspection projectId from context:", contextInspection.projectId);
          const normalizedData = normalizeInspectionData(contextInspection);
          setInspection(normalizedData);
          return;
        }
        
        // Not in context, try to fetch from MongoDB API
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
        console.error("Error fetching inspection:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setError(errorMessage);
        toast.error("Failed to load inspection");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInspectionData();
  }, [id, router, getInspectionById]);

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
    if (!inspection) return;
    
    // Helper function to find font family from CSS @font-face declarations (same as in render)
    const findFontFamilyFromCSS = (fontUrl: string) => {
      if (!inspection.fontFaceDeclarations?.length) {
        return 'Unknown';
      }
      
      // Try to match the font URL with @font-face declarations
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
      
      return 'Unknown';
    };
    
    // Prepare CSV data
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers for downloadedFonts
    csvContent += "Font Family,Font Name,Format,Size (KB),URL,Source\n";
    
    // Add downloaded fonts data
    if (inspection.downloadedFonts?.length) {
      inspection.downloadedFonts.forEach((font: FontFile) => {
        const fontFamily = findFontFamilyFromCSS(font.url);
        const row = [
          fontFamily,
          font.name || 'Unknown',
          font.format || 'Unknown',
          (font.size / 1024).toFixed(2) || '0',
          font.url || '',
          font.source || 'Unknown'
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
        
        csvContent += row + "\n";
      });
    }
    
    // Add a separator if we have active fonts data too
    if (inspection.activeFonts?.length && inspection.downloadedFonts?.length) {
      csvContent += "\n";
      csvContent += "Active Fonts\n";
      csvContent += "Font Family,Element Count\n";
      
      inspection.activeFonts.forEach((font: ActiveFont) => {
        const elementCount = font.elementCount || font.count || 0;
        const row = [
          font.family || 'Unknown',
          elementCount.toString()
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
        
        csvContent += row + "\n";
      });
    }
    
    // Create and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `font-inspection-${inspection.url.replace(/[^a-z0-9]/gi, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Results exported successfully!");
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
        <Tabs defaultValue="summary" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="fonts" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Downloaded Fonts
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Active Fonts
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Inspection Summary
                </CardTitle>
                <CardDescription>Overview of inspection results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-lg shadow-sm">
                    <span className="text-4xl font-bold text-slate-800">{summary.totalFonts}</span>
                    <span className="text-sm text-muted-foreground mt-2">Font Files Detected</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-lg shadow-sm">
                    <span className="text-4xl font-bold text-slate-800">{summary.activeCount}</span>
                    <span className="text-sm text-muted-foreground mt-2">Actively Used Fonts</span>
                  </div>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4 text-slate-700">Font Usage Breakdown</h3>
                  <div className="border rounded-md shadow-sm overflow-hidden">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="font-semibold border-b bg-slate-50">
                          <th className="p-4 text-left text-slate-700">Font Name</th>
                          <th className="p-4 text-left text-slate-700">Usage Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.allFonts.length > 0 ? (
                          summary.allFonts.map((font: {name: string, count: number}, index: number) => (
                            <tr key={index} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-medium text-slate-800">{font.name}</td>
                              <td className="p-4">
                                <div className="flex items-center">
                                  <span className="mr-2 font-medium tabular-nums">{font.count}</span>
                                  <span className="text-xs text-muted-foreground">elements</span>
                                  <div className="ml-3 bg-slate-200 h-2 rounded-full flex-grow">
                                    <div 
                                      className="bg-primary h-2 rounded-full" 
                                      style={{ 
                                        width: `${Math.max(5, Math.min(100, (font.count / Math.max(...summary.allFonts.map((f) => f.count))) * 100))}%` 
                                      }} 
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="p-6 text-center text-gray-500">
                              No active fonts detected
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                  <ResizableTable columnCount={6} className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b h-14">
                        <ResizableHeader index={0} className="font-semibold p-4 text-slate-700">Font Family</ResizableHeader>
                        <ResizableHeader index={1} className="font-semibold p-4 text-slate-700">Font Name</ResizableHeader>
                        <ResizableHeader index={2} className="font-semibold p-4 text-slate-700">Format</ResizableHeader>
                        <ResizableHeader index={3} className="font-semibold p-4 text-slate-700">Size</ResizableHeader>
                        <ResizableHeader index={4} className="font-semibold p-4 text-slate-700">Source</ResizableHeader>
                        <ResizableHeader index={5} className="font-semibold p-4 text-slate-700">URL</ResizableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {inspection.downloadedFonts?.length > 0 ? (
                        inspection.downloadedFonts.map((font: FontFile, index: number) => {
                          // Helper function to find font family from CSS @font-face declarations
                          const findFontFamilyFromCSS = (fontUrl: string) => {
                            // First, try to match with active fonts (most reliable)
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
                                
                                // Multiple matching strategies
                                return (
                                  // Direct match
                                  activeFontName === basicName ||
                                  // Font name contains family name
                                  fontFileName.includes(activeFontName) ||
                                  // Family name contains extracted name
                                  activeFontName.includes(basicName) ||
                                  // Partial word matching
                                  basicName.includes(activeFontName) ||
                                  // Match without hyphens/underscores
                                  fontFileName.replace(/[-_]/g, '').includes(activeFontName.replace(/[-_]/g, ''))
                                );
                              });
                              
                              if (matchingActiveFont) {
                                return matchingActiveFont.family.replace(/["']/g, '').trim();
                              }
                            }
                            
                            // Second, try CSS @font-face declarations
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
                            
                            // Final fallback: extract from filename with better logic
                            const cleanName = font.name
                              .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '') // Remove extension
                              .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '') // Remove weight/style
                              .replace(/[-_]Variable.*$/i, '') // Remove Variable
                              .replace(/[-_]\d+.*$/i, '') // Remove numbers
                              .replace(/[-_]/g, ' ') // Convert separators to spaces
                              .trim();
                            
                            return cleanName || 'Unknown';
                          };

                          const fontFamily = findFontFamilyFromCSS(font.url);

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
                              <ResizableCell index={5} className="p-4 text-xs">
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
                          <td colSpan={6} className="p-6 text-center text-gray-500">
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
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <h3 className="text-lg font-semibold text-slate-800">{font.family}</h3>
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
    </div>
  );
} 