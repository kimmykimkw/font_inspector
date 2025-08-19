"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResizableTable, ResizableHeader, ResizableCell } from "@/components/ui/resizable";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { authenticatedFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  FolderOpen, 
  Calendar, 
  Globe, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  BarChart3, 
  Type, 
  Download, 
  TrendingUp,
  Activity,
  ExternalLink,
  AlertTriangle,
  XCircle,
  CheckCircle
} from "lucide-react";

// Define types based on MongoDB models
interface Inspection {
  _id: string;
  url: string;
  timestamp?: string;
  downloadedFonts: FontFile[];
  activeFonts: ActiveFont[];
  createdAt?: string;
  updatedAt?: string;
  projectId?: string;
  status?: string;
  result?: any;
}

interface Project {
  _id: string;
  name: string;
  description?: string;
  inspections: Inspection[];
  createdAt: string;
  updatedAt: string;
}

interface FontFile {
  name: string;
  format: string;
  size: number;
  url: string;
  source: string;
  websiteUrl?: string; // Added for aggregation
}

interface ActiveFont {
  family: string;
  count: number;
  elements: number;
  preview?: string;
  elementCount?: number;
  websiteUrl?: string; // Added for aggregation
}

export default function ProjectResultsPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{show: boolean, content: string, x: number, y: number}>({
    show: false,
    content: '',
    x: 0,
    y: 0
  });
  
  // Fetch project data with authentication
  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      
      // Wait for auth to complete
      if (authLoading) {
        return;
      }
      
      // Redirect to home if not authenticated
      if (!user) {
        router.push('/');
        return;
      }
      
      try {
        setLoading(true);
        
        const response = await authenticatedFetch(`/api/projects/${id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch project: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Fetched project data:", data);
        
        setProject(data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error fetching project:", errorMessage);
        setError(errorMessage);
        toast.error("Failed to load project data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchProject();
  }, [id, user, authLoading, router]);

  // If loading or no data
  if (loading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading project data...</CardTitle>
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
  
  // If error or no project found
  if (error || !project) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Project</CardTitle>
            <CardDescription>
              {error || "Project not found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format the date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      return "Invalid date";
    }
  };

  // Function to extract descriptive page name from URL
  const getWebsiteName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      // Remove 'www.' prefix if present
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      
      // If it's just the root path, return the hostname
      if (pathname === '/' || pathname === '') {
        return `${hostname} (Home)`;
      }
      
      // Extract meaningful path segments
      const pathSegments = pathname.split('/').filter(segment => segment.length > 0);
      
      if (pathSegments.length > 0) {
        // Get the last meaningful segment and clean it up
        const lastSegment = pathSegments[pathSegments.length - 1];
        
        // Convert common path patterns to readable names
        const pathName = lastSegment
          .replace(/[-_]/g, ' ')
          .replace(/\.(html|php|aspx?)$/i, '')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        // Special cases for common page types
        if (lastSegment.toLowerCase().includes('about')) return `${hostname} (About)`;
        if (lastSegment.toLowerCase().includes('contact')) return `${hostname} (Contact)`;
        if (lastSegment.toLowerCase().includes('product')) return `${hostname} (Products)`;
        if (lastSegment.toLowerCase().includes('service')) return `${hostname} (Services)`;
        if (lastSegment.toLowerCase().includes('blog')) return `${hostname} (Blog)`;
        if (lastSegment.toLowerCase().includes('news')) return `${hostname} (News)`;
        
        // For other paths, show hostname + path
        return `${hostname} (${pathName})`;
      }
      
      return hostname;
    } catch (error) {
      // If URL parsing fails, return a cleaned version
      return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    }
  };

  // Check if project has inspections
  const hasInspections = project.inspections && project.inspections.length > 0;
  
  // If no inspections yet
  if (!hasInspections) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>
              Created on {formatDate(project.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">This project has no inspections yet.</p>
            <Button onClick={() => router.push('/')}>
              Add Inspections
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Aggregate all fonts from all inspections
  const allFonts: FontFile[] = [];
  const websiteFontMap: Record<string, string[]> = {};
  const allActiveFonts: {family: string, elementCount: number, websiteUrl: string}[] = [];
  
  // Separate successful and failed inspections based on status field
  const failedInspections = project.inspections.filter(inspection => {
    // Primary check: explicit failed status
    return inspection.status === 'failed';
  });
  
  const successfulInspections = project.inspections.filter(inspection => {
    // Primary check: not explicitly failed
    if (inspection.status === 'failed') {
      return false;
    }
    
    // Secondary check: has valid data (for backwards compatibility)
    const hasValidData = inspection.result?.result || 
                        inspection.downloadedFonts || 
                        inspection.activeFonts;
    
    return hasValidData;
  });
  
  successfulInspections.forEach(inspection => {
    const websiteUrl = inspection.url;
    websiteFontMap[websiteUrl] = [];
    
    // Handle inspections from context
    if (inspection.result?.result) {
      // Add downloaded fonts
      inspection.result.result.downloadedFonts.forEach((font: FontFile) => {
        websiteFontMap[websiteUrl].push(font.name);
        
        // Check if this font is already in allFonts
        const existingFontIndex = allFonts.findIndex(f => 
          f.name === font.name && f.format === font.format
        );
        
        if (existingFontIndex === -1) {
          // Add as a new font with website information
          allFonts.push({
            ...font,
            websiteUrl
          });
        }
      });

      // Add active fonts with website information
      if (inspection.result.result.activeFonts) {
        inspection.result.result.activeFonts.forEach((font: ActiveFont) => {
          allActiveFonts.push({
            family: font.family,
            elementCount: font.elementCount || font.count || 0,
            websiteUrl
          });
        });
      }
    } 
    // Handle direct MongoDB inspections
    else {
      // Add downloaded fonts
      if (inspection.downloadedFonts && Array.isArray(inspection.downloadedFonts)) {
        inspection.downloadedFonts.forEach((font: FontFile) => {
          websiteFontMap[websiteUrl].push(font.name);
          
          // Check if this font is already in allFonts
          const existingFontIndex = allFonts.findIndex(f => 
            f.name === font.name && f.format === font.format
          );
          
          if (existingFontIndex === -1) {
            // Add as a new font with website information
            allFonts.push({
              ...font,
              websiteUrl
            });
          }
        });
      }

      // Add active fonts with website information
      if (inspection.activeFonts && Array.isArray(inspection.activeFonts)) {
        inspection.activeFonts.forEach((font: ActiveFont) => {
          allActiveFonts.push({
            family: font.family,
            elementCount: font.elementCount || font.count || 0,
            websiteUrl
          });
        });
      }
    }
  });

  // Count how many websites use each font
  const fontUsageCount: Record<string, number> = {};
  
  Object.values(websiteFontMap).forEach(fontNames => {
    fontNames.forEach(name => {
      fontUsageCount[name] = (fontUsageCount[name] || 0) + 1;
    });
  });

  // Get unique URLs and assign colors deterministically
  const uniqueUrls = [...new Set(allFonts.map(font => font.websiteUrl).filter(Boolean))];
  const urlColorMap = new Map<string, string>();
  
  const colors = [
    'text-blue-600 bg-blue-50 border border-blue-200',
    'text-green-600 bg-green-50 border border-green-200', 
    'text-purple-600 bg-purple-50 border border-purple-200',
    'text-orange-600 bg-orange-50 border border-orange-200',
    'text-pink-600 bg-pink-50 border border-pink-200',
    'text-indigo-600 bg-indigo-50 border border-indigo-200',
    'text-cyan-600 bg-cyan-50 border border-cyan-200',
    'text-red-600 bg-red-50 border border-red-200',
    'text-yellow-600 bg-yellow-50 border border-yellow-200',
    'text-teal-600 bg-teal-50 border border-teal-200'
  ];

  // Assign colors sequentially to ensure no duplicates
  uniqueUrls.forEach((url, index) => {
    if (url) {
      urlColorMap.set(url, colors[index % colors.length]);
    }
  });

  // Function to get color for different URLs
  const getUrlColor = (url: string): string => {
    return urlColorMap.get(url) || colors[0];
  };

  // Tooltip handlers
  const handleMouseEnter = (e: React.MouseEvent, isFailed: boolean, errorMessage?: string) => {
    if (isFailed && errorMessage) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        show: true,
        content: `Inspection failed: ${errorMessage}`,
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, content: '', x: 0, y: 0 });
  };

  // Prepare summary data
  const summary = {
    totalFonts: allFonts.length,
    activeCount: allActiveFonts.length,
    allFonts: allActiveFonts.reduce<{name: string, count: number}[]>((acc, font) => {
      const existingFont = acc.find(f => f.name === font.family);
      if (existingFont) {
        existingFont.count += font.elementCount;
      } else {
        acc.push({
          name: font.family,
          count: font.elementCount
        });
      }
      return acc;
    }, []).sort((a, b) => b.count - a.count)
  };

  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!project || !project._id) {
      toast.error("Cannot delete: project ID is missing");
      return;
    }
    
    if (!user) {
      toast.error("Authentication required to delete project");
      return;
    }
    
    try {
      setLoading(true);
      
      // Call API to delete project with authentication
      const response = await authenticatedFetch(`/api/projects/${project._id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete project (${response.status})`);
      }
      
      // Show success message
      toast.success("Project and all associated inspections deleted successfully");
      
      // Redirect to history page
      router.push('/history');
    } catch (error) {
      console.error("Error deleting project:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete project: ${errorMessage}`);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Project Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-neutral-700" />
            <h1 className="text-3xl font-bold">Project Results</h1>
          </div>
        </div>
                  <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/history?tab=projects')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Button>
          <Button variant="outline" onClick={() => router.push('/')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Websites
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Delete Project
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Project Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {project.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created on {formatDate(project.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              This project includes inspections for {project.inspections.length} webpages
              {failedInspections.length > 0 && (
                <span className="ml-1">
                  ({successfulInspections.length} successful, {failedInspections.length} failed)
                </span>
              )}:
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {project.inspections
                .reduce((uniqueInspections, inspection) => {
                  // Check if we already have an inspection for this URL
                  const existingIndex = uniqueInspections.findIndex(ui => ui.url === inspection.url);
                  
                  if (existingIndex === -1) {
                    // No existing inspection for this URL, add it
                    uniqueInspections.push(inspection);
                  } else {
                    // URL already exists, keep the most recent one (by timestamp or creation date)
                    const existing = uniqueInspections[existingIndex];
                    const existingTime = new Date(existing.createdAt || existing.timestamp || 0).getTime();
                    const currentTime = new Date(inspection.createdAt || inspection.timestamp || 0).getTime();
                    
                    // Replace with more recent inspection
                    if (currentTime > existingTime) {
                      uniqueInspections[existingIndex] = inspection;
                    }
                  }
                  
                  return uniqueInspections;
                }, [] as typeof project.inspections)
                .map(inspection => {
                const isFailed = failedInspections.some(failed => failed._id === inspection._id);
                
                return (
                  <div 
                    key={inspection._id}
                    className={`text-xs px-2 py-1 rounded-full ${
                      isFailed 
                        ? 'bg-red-100 text-red-800 border border-red-200' 
                        : 'bg-green-100 text-green-800 border border-green-200'
                    }`}
                    onMouseEnter={(e) => handleMouseEnter(e, isFailed, (inspection as any).error || 'No specific error message')}
                    onMouseLeave={handleMouseLeave}
                  >
                    {inspection.url}
                    {isFailed && <XCircle className="w-3 h-3 ml-1 inline" />}
                    {!isFailed && <CheckCircle className="w-3 h-3 ml-1 inline" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Project Summary
            </CardTitle>
            <CardDescription>Overview of all inspections</CardDescription>
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
            
            {/* Most Active Font per Website Section */}
            <div className="mt-6 mb-6">
              <h3 className="text-lg font-medium mb-4 text-slate-700 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Most Active Font per Webpage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {successfulInspections.map(inspection => {
                  // Find the most active font for this website
                  const websiteActiveFonts = allActiveFonts.filter(
                    font => font.websiteUrl === inspection.url
                  );
                  
                  const mostActiveFont = websiteActiveFonts.length > 0 
                    ? [...websiteActiveFonts].sort((a, b) => b.elementCount - a.elementCount)[0] 
                    : null;
                  
                  if (!mostActiveFont) {
                    return null;
                  }
                  
                  const websiteName = getWebsiteName(inspection.url);
                  
                  return (
                    <div 
                      key={inspection._id}
                      className="group border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
                      onClick={() => router.push(`/results/${inspection._id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                                                 <div className="flex-1 min-w-0">
                           <div className="text-base text-blue-700 font-bold truncate">
                             {websiteName}
                           </div>
                           <div className="font-medium text-slate-700 truncate text-sm mt-1">{mostActiveFont.family}</div>
                         </div>
                        <div className="ml-3 flex items-center text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
                          <span className="font-medium text-slate-700">{mostActiveFont.elementCount}</span>
                          <span className="ml-1">elements</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 truncate group-hover:text-slate-500 transition-colors">
                        {inspection.url}
                      </div>
                      <div className="mt-2 flex items-center text-xs text-blue-600 group-hover:text-blue-700 transition-colors">
                        <span>View details</span>
                        <ExternalLink className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4 text-slate-700 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Font Usage Breakdown
              </h3>
              <div className="border rounded-md shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="font-medium border-b bg-slate-50">
                      <th className="p-4 text-left w-1/2">Font Name</th>
                      <th className="p-4 text-left w-1/2">Usage Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.allFonts.length > 0 ? (
                      summary.allFonts.map((font: {name: string, count: number}, index: number) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium">{font.name}</td>
                          <td className="p-4 flex items-center">
                            <span className="mr-2">{font.count}</span>
                            <span className="text-xs text-muted-foreground">elements</span>
                            <div className="ml-2 bg-slate-200 h-2 rounded-full flex-grow">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ 
                                  width: `${(font.count / Math.max(...summary.allFonts.map(f => f.count))) * 100}%` 
                                }}
                              ></div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-muted-foreground">
                          No font usage data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4 text-slate-700 flex items-center gap-2">
                <Type className="h-5 w-5" />
                All Detected Font Files
              </h3>
              {allFonts.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <ResizableTable columnCount={6} className="w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <ResizableHeader index={0} className="p-3 text-left font-medium w-1/6">Font Family</ResizableHeader>
                        <ResizableHeader index={1} className="p-3 text-left font-medium w-1/6">Font Name</ResizableHeader>
                        <ResizableHeader index={2} className="p-3 text-left font-medium w-[80px]">Format</ResizableHeader>
                        <ResizableHeader index={3} className="p-3 text-left font-medium w-[100px]">Size (KB)</ResizableHeader>
                        <ResizableHeader index={4} className="p-3 text-left font-medium w-[150px]">Source</ResizableHeader>
                        <ResizableHeader index={5} className="p-3 text-left font-medium w-1/6">Webpage</ResizableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {allFonts.map((font, index) => {
                        // Helper function to find font family using metadata-first approach
                        const findFontFamilyFromMetadata = (fontFile: any) => {
                          // PRIORITY 1: Use metadata font name (most accurate)
                          if (fontFile.metadata?.fontName) {
                            return fontFile.metadata.fontName;
                          }
                          
                          // PRIORITY 2: Try to match with active fonts from the same website (most reliable)
                          if (allActiveFonts?.length > 0) {
                            const matchingActiveFont = allActiveFonts.find(activeFont => {
                              // Only match fonts from the same website
                              if (activeFont.websiteUrl !== fontFile.websiteUrl) {
                                return false;
                              }
                              
                              const activeFontName = activeFont.family.toLowerCase().replace(/["'\s]/g, '').trim();
                              const fontFileName = fontFile.name.toLowerCase().replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '');
                              
                              // Multiple matching strategies
                              const metadataMatch = fontFile.metadata?.fontName && 
                                fontFile.metadata.fontName.toLowerCase().replace(/["'\s]/g, '').trim() === activeFontName;
                              const directMatch = activeFontName === fontFileName;
                              const filenameContainsFamily = fontFileName.includes(activeFontName);
                              const familyContainsFilename = activeFontName.includes(fontFileName);
                              const noHyphensMatch = fontFileName.replace(/[-_]/g, '').includes(activeFontName.replace(/[-_]/g, ''));
                              const partialWordMatch = fontFileName.includes(activeFontName.split(' ')[0].toLowerCase());
                              const filenameWordMatch = activeFontName.includes(fontFileName.split(/[-_]/)[0]);
                              
                              // Enhanced metadata matching
                              const metadataWords = fontFile.metadata?.fontName ? 
                                fontFile.metadata.fontName.toLowerCase().replace(/["'\s]/g, '').replace(/[^a-z]/g, '') : '';
                              const activeFontWords = activeFontName.replace(/[-_]/g, '').replace(/[^a-z]/g, '');
                              
                              // Multiple strategies for metadata matching
                              const metadataExactMatch = metadataWords === activeFontWords;
                              const metadataContainsActive = metadataWords.includes(activeFontWords);
                              const activeContainsMetadata = activeFontWords.includes(metadataWords);
                              
                              // Check for common word prefixes
                              const findCommonPrefix = (str1: string, str2: string) => {
                                let i = 0;
                                while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
                                  i++;
                                }
                                return str1.substring(0, i);
                              };
                              
                              const commonPrefix = findCommonPrefix(metadataWords, activeFontWords);
                              const hasSignificantCommonPrefix = commonPrefix.length >= 8;
                              
                              // Split into words and check for overlap
                              const metadataWordParts = fontFile.metadata?.fontName ? 
                                fontFile.metadata.fontName.toLowerCase().split(/[\s-_]+/).filter((w: string) => w.length > 2) : [];
                              const activeFontWordParts = activeFontName.split(/[\s-_]+/).filter((w: string) => w.length > 2);
                              
                              const hasCommonWords = metadataWordParts.some((metaPart: string) => 
                                activeFontWordParts.some((activePart: string) => 
                                  metaPart.includes(activePart) || activePart.includes(metaPart)
                                )
                              );
                              
                              const metadataPartialMatch = metadataExactMatch || metadataContainsActive || activeContainsMetadata || hasSignificantCommonPrefix || hasCommonWords;
                              
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
                          
                          // PRIORITY 3: Fallback to filename-based extraction
                          const basicName = fontFile.name
                            .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '')
                            .replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic|Oblique|Normal).*$/i, '')
                            .replace(/[-_]Variable.*$/i, '')
                            .replace(/[-_]\d+.*$/i, '')
                            .replace(/[-_]/g, ' ')
                            .trim();
                          
                          return basicName || 'Unknown';
                        };

                        const fontFamily = findFontFamilyFromMetadata(font);

                        return (
                          <tr key={index} className="border-t hover:bg-slate-50">
                            <ResizableCell index={0} className="p-3 font-medium truncate">{fontFamily}</ResizableCell>
                            <ResizableCell index={1} className="p-3 text-sm truncate">{font.name}</ResizableCell>
                            <ResizableCell index={2} className="p-3">{font.format}</ResizableCell>
                            <ResizableCell index={3} className="p-3">{(font.size / 1024).toFixed(2)} KB</ResizableCell>
                            <ResizableCell index={4} className="p-3">
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
                            <ResizableCell index={5} className="p-3 truncate">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getUrlColor(font.websiteUrl || '')}`}>
                                {getWebsiteName(font.websiteUrl || '')}
                              </span>
                            </ResizableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </ResizableTable>
                </div>
              ) : (
                <div className="p-4 border rounded-md text-center text-muted-foreground">
                  No font files detected
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Floating Tooltip */}
      {tooltip.show && (
        <div 
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.content}
          <div className="absolute left-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 transform -translate-x-1/2"></div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project and all its associated inspection results? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 