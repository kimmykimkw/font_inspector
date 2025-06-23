"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Link from "next/link";
import { CalendarIcon, FolderIcon, ExternalLinkIcon, TrashIcon, GlobeIcon, DownloadIcon, TypeIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase-client";

// Define a Skeleton component since we're having import issues
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 ${className || ""}`}
      {...props}
    />
  );
}

type Inspection = {
  _id: string;
  url: string;
  timestamp: string;    // Using the confirmed field from the MongoDB model
  downloadedFonts: any[];
  activeFonts: any[];
  createdAt?: string;   // Optional since it might come from timestamps: true
  projectId?: string;   // Reference to project this inspection belongs to
};

type Project = {
  _id: string;
  name: string;
  description: string;
  inspections: string[] | Inspection[]; // Array of inspection IDs or populated inspections
  inspectionIds?: string[]; // Firebase uses inspectionIds instead of inspections
  createdAt: string;
  updatedAt: string;
};

function HistoryPageContent() {
  const { user, loading: authLoading } = useAuth(); // Get auth state
  const searchParams = useSearchParams();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "inspections");
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'inspection' | 'project' } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const itemsPerPage = 15; // Increased since items are more compact now

  // Format date in a user-friendly way
  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      console.error("Date parsing error:", e);
      return "Invalid date";
    }
  };

  // Format date in a compact way for the list view
  const formatCompactDate = (dateString: string) => {
    if (!dateString) return "Unknown";
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return "Today";
      if (diffDays === 2) return "Yesterday";
      if (diffDays <= 7) return `${diffDays - 1}d ago`;
      if (diffDays <= 30) return `${Math.floor(diffDays / 7)}w ago`;
      
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
      });
    } catch (e) {
      return "Invalid";
    }
  };

  // Fetch inspection history from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("Frontend: Starting data fetch...");
        console.log("Frontend: Auth loading:", authLoading, "User:", user?.uid);
        
        // Don't fetch if still loading auth or no user
        if (authLoading) {
          console.log("Frontend: Still loading authentication, waiting...");
          return;
        }
        
        if (!user) {
          console.log("Frontend: No authenticated user, cannot fetch data");
          setError("Please sign in to view your inspection history");
          return;
        }
        
        console.log("Frontend: User authenticated, proceeding with data fetch");
        
        try {
          // Fetch inspections using authenticated API client
          console.log("Frontend: Fetching inspection history");
          const inspectionData = await apiClient.getHistory();
          
          // Fetch projects using authenticated API client
          console.log("Frontend: Fetching project history");
          const projectData = await apiClient.getProjects();
          
          console.log("Frontend: Fetched inspections:", inspectionData.length);
          console.log("Frontend: Fetched projects:", projectData.length);
          
          // Filter out inspections that are part of projects to avoid duplication
          const standaloneInspections = inspectionData.filter((inspection: Inspection) => !inspection.projectId);
          
          setInspections(standaloneInspections);
          setProjects(projectData);
        } catch (apiClientError) {
          console.error("Frontend: API client failed, trying direct fetch...", apiClientError);
          
          // Fallback: Try direct fetch with auth token
          if (auth?.currentUser) {
            try {
              const token = await auth.currentUser.getIdToken(true);
              
              console.log("Frontend: Trying direct fetch with token...");
              
              // Direct fetch for projects
              const projectResponse = await fetch('/api/projects', {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (projectResponse.ok) {
                const projectData = await projectResponse.json();
                console.log("Frontend: Direct fetch successful:", projectData.length, "projects");
                setProjects(projectData);
                setInspections([]); // Set empty for now
              } else {
                const errorText = await projectResponse.text();
                console.error("Frontend: Direct fetch failed:", projectResponse.status, errorText);
                throw new Error(`Direct fetch failed: ${errorText}`);
              }
            } catch (directFetchError) {
              console.error("Frontend: Direct fetch also failed:", directFetchError);
              throw apiClientError; // Re-throw original error
            }
          } else {
            throw apiClientError; // Re-throw original error
          }
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Frontend: Error fetching data:", errorMessage);
        setError(errorMessage);
        
        // Show more helpful error notification
        const isAuthError = errorMessage.includes('Authentication required') || 
                           errorMessage.includes('Please sign in');
        
        const isFirebaseError = errorMessage.includes('Firebase') || 
                                errorMessage.includes('Firestore') || 
                                errorMessage.includes('Internal Server Error');
        
        if (isAuthError) {
          toast.error("Authentication error", {
            description: "Please sign out and sign back in to refresh your session",
            duration: 5000
          });
        } else if (isFirebaseError) {
          toast.error("Firebase connection error. Please check your database configuration.", {
            description: "Contact your administrator if this problem persists",
            duration: 5000
          });
        } else {
          toast.error("Failed to load history data", {
            description: errorMessage,
            duration: 5000
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading]); // Depend on both user and authLoading

  // Filter and sort inspections or projects based on search term and active tab
  const filteredItems = activeTab === "inspections" 
    ? inspections
        .filter((inspection) => inspection.url.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
          // Sort by most recent first - use createdAt or timestamp
          const dateA = new Date(a.createdAt || a.timestamp).getTime();
          const dateB = new Date(b.createdAt || b.timestamp).getTime();
          return dateB - dateA; // Descending order (most recent first)
        })
    : projects
        .filter((project) => project.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
          // Sort by most recent updatedAt first, then by createdAt
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA; // Descending order (most recent first)
        });

  // Paginate items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Helper function to get inspection count for a project
  const getInspectionCount = (project: Project) => {
    if (project.inspections && Array.isArray(project.inspections)) {
      return project.inspections.length;
    } else if (project.inspectionIds && Array.isArray(project.inspectionIds)) {
      return project.inspectionIds.length;
    }
    return 0;
  };

  // Delete handler for inspections and projects
  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    const { id, type } = itemToDelete;
    
    try {
      setLoading(true);
      
      if (type === 'inspection') {
        await apiClient.deleteInspection(id);
        // Remove the deleted item from state
        setInspections(prev => prev.filter(item => item._id !== id));
        toast.success("Inspection deleted successfully");
      } else {
        // For projects, we need to make a direct authenticated fetch since it's not in apiClient yet
        const response = await fetch(`/api/projects/${id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to delete ${type}`);
        }
        
        // Remove the deleted item from state
        setProjects(prev => prev.filter(item => item._id !== id));
        toast.success("Project and all associated inspections deleted successfully");
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete: ${errorMessage}`);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };
  
  // Handle delete button click
  const handleDeleteClick = (id: string, type: 'inspection' | 'project') => {
    setItemToDelete({ id, type });
    setDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col gap-6">
        
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inspection History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage your past font inspections and projects
            </p>
          </div>
        </div>

        {/* Tabs and Search */}
        <div className="space-y-4">
          <Tabs defaultValue="inspections" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <TabsList className="mb-2 sm:mb-0">
                <TabsTrigger value="inspections" className="text-sm">
                  Individual Inspections
                  {inspections.length > 0 && (
                    <span className="ml-2 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                      {inspections.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="projects" className="text-sm">
                  Projects
                  {projects.length > 0 && (
                    <span className="ml-2 bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                      {projects.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full max-w-sm">
                <Input
                  type="text"
                  placeholder={activeTab === "inspections" ? "Search by URL..." : "Search by project name..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <TabsContent value="inspections" className="mt-0">
              {/* Individual Inspections Content */}
              <div className="space-y-2">
                {loading ? (
                  // Loading skeletons - more compact
                  Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : activeTab === "inspections" && currentItems.length > 0 ? (
                  currentItems.map((item) => {
                    const inspection = item as Inspection;
                    return (
                      <Link key={inspection._id} href={`/results/${inspection._id}`}>
                        <div className="border rounded-lg p-3 bg-white hover:bg-slate-50 transition-colors group cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <GlobeIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate" title={inspection.url}>
                                  {inspection.url}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {formatCompactDate(inspection.createdAt || inspection.timestamp)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="flex items-center gap-3 text-xs text-slate-600">
                                <div className="flex items-center gap-1">
                                  <DownloadIcon className="h-3 w-3" />
                                  <span>{inspection.downloadedFonts?.length || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <TypeIcon className="h-3 w-3" />
                                  <span>{inspection.activeFonts?.length || 0}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="outline" className="h-7 px-3 text-xs pointer-events-none">
                                  View
                                </Button>
                                {!inspection.projectId && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteClick(inspection._id, 'inspection');
                                    }}
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <GlobeIcon className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-sm font-medium mb-1">No inspection records found</p>
                    <p className="text-xs">Start by analyzing a website to see your inspections here</p>
                    {searchTerm && (
                      <Button 
                        variant="link" 
                        onClick={() => setSearchTerm("")}
                        className="mt-2 text-xs"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="projects" className="mt-0">
              {/* Projects Content */}
              <div className="space-y-2">
                {loading ? (
                  // Loading skeletons for projects - more compact
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Skeleton className="h-4 w-4 rounded mt-0.5" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-1/4 mb-2" />
                            <Skeleton className="h-3 w-1/3 mb-1" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="h-7 w-7" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : activeTab === "projects" && currentItems.length > 0 ? (
                  currentItems.map((item) => {
                    const project = item as Project;
                    return (
                      <Link key={project._id} href={`/project/${project._id}`}>
                        <div className="border rounded-lg p-4 bg-white hover:bg-slate-50 transition-colors group cursor-pointer">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <FolderIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-slate-900 mb-1" title={project.name}>
                                  {project.name}
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                                  <span>{getInspectionCount(project)} websites</span>
                                  <span>Created {formatCompactDate(project.createdAt)}</span>
                                  <span>Updated {formatCompactDate(project.updatedAt)}</span>
                                </div>
                                {project.description && (
                                  <p className="text-xs text-slate-600 line-clamp-2" title={project.description}>
                                    {project.description}
                                  </p>
                                )}
                                {project.inspections && Array.isArray(project.inspections) && project.inspections.length > 0 && (
                                  <div className="mt-2">
                                    <div className="flex flex-wrap gap-1">
                                      {project.inspections.slice(0, 2).map((inspection: any) => (
                                        <span 
                                          key={inspection._id} 
                                          className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded truncate max-w-40"
                                          title={inspection.url}
                                        >
                                          {inspection.url}
                                        </span>
                                      ))}
                                      {project.inspections.length > 2 && (
                                        <span className="inline-block text-slate-400 text-xs px-1">
                                          +{project.inspections.length - 2} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button size="sm" variant="outline" className="h-8 px-3 text-xs pointer-events-none">
                                View Project
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteClick(project._id, 'project');
                                }}
                              >
                                <TrashIcon className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <FolderIcon className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-sm font-medium mb-1">No projects found</p>
                    <p className="text-xs">Create a project to organize your inspections</p>
                    {searchTerm && (
                      <Button 
                        variant="link" 
                        onClick={() => setSearchTerm("")}
                        className="mt-2 text-xs"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <svg
                  className="h-10 w-10 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                
                <div>
                  <h3 className="text-lg font-medium text-red-800">Error Loading Data</h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
                
                <Button onClick={() => window.location.reload()}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 text-xs"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-3 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {itemToDelete?.type === 'inspection' ? 'Inspection' : 'Project'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'inspection' 
                ? 'Are you sure you want to delete this inspection? This action cannot be undone.'
                : 'Are you sure you want to delete this project and all its associated inspection results? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
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

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading...</div>}>
      <HistoryPageContent />
    </Suspense>
  );
}