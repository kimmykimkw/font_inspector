"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useInspection } from "@/contexts/InspectionContext";
import { useState, useEffect } from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "./ui/select";
import { Input } from "./ui/input";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "./ui/pagination";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon, Trash2Icon, FileDownIcon, MoreHorizontalIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, formatTimestamp } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function RecentInspections() {
  const router = useRouter();
  const { recentInspections, deleteInspection, exportInspectionToCsv } = useInspection();
  
  // Sorting and filtering states
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [filterText, setFilterText] = useState<string>("");
  const [filteredInspections, setFilteredInspections] = useState(recentInspections);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  
  // Date range filtering
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<string | null>(null);

  // Function to format the date
  const formatDate = (date: Date) => {
    // If it's less than a day ago, show relative time
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    if (diff < ONE_DAY) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours < 1) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    // Otherwise, show the date
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...recentInspections];
    
    // Apply text filter
    if (filterText) {
      filtered = filtered.filter(item => 
        item.url.toLowerCase().includes(filterText.toLowerCase())
      );
    }
    
    // Apply date range filter
    if (startDate) {
      filtered = filtered.filter(item => 
        item.completedAt && new Date(item.completedAt) >= startDate
      );
    }
    
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => 
        item.completedAt && new Date(item.completedAt) <= endOfDay
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0);
        case "date-desc":
          return (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0);
        case "fonts-asc":
          return (a.result?.result?.downloadedFonts?.length || 0) - (b.result?.result?.downloadedFonts?.length || 0);
        case "fonts-desc":
          return (b.result?.result?.downloadedFonts?.length || 0) - (a.result?.result?.downloadedFonts?.length || 0);
        case "url-asc":
          return a.url.localeCompare(b.url);
        case "url-desc":
          return b.url.localeCompare(a.url);
        default:
          return (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0);
      }
    });
    
    setFilteredInspections(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [recentInspections, filterText, sortBy, startDate, endDate]);

  const handleViewResults = (id: string) => {
    router.push(`/results/${id}`);
  };

  const handleDeleteInspection = (id: string) => {
    setInspectionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (inspectionToDelete) {
      deleteInspection(inspectionToDelete);
      setDeleteDialogOpen(false);
      setInspectionToDelete(null);
    }
  };

  const handleExportCsv = (id: string) => {
    exportInspectionToCsv(id);
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredInspections.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredInspections.slice(indexOfFirstItem, indexOfLastItem);
  
  // Generate page numbers array for pagination
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (recentInspections.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Recent Inspections</CardTitle>
        <CardDescription>Previously analyzed websites</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter and sort controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Filter by URL..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-row gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[240px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    format(startDate, "PPP")
                  ) : (
                    "Start Date"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[240px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? (
                    format(endDate, "PPP")
                  ) : (
                    "End Date"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="fonts-desc">Most fonts</SelectItem>
                <SelectItem value="fonts-asc">Least fonts</SelectItem>
                <SelectItem value="url-asc">URL (A-Z)</SelectItem>
                <SelectItem value="url-desc">URL (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Display results */}
        <div className="space-y-4">
          {currentItems.length > 0 ? (
            currentItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-md">
                <div>
                  <h3 className="font-medium">{item.url}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.completedAt && formatDate(item.completedAt)}
                  </p>
                  <p className="text-sm">
                    {item.result?.result?.downloadedFonts?.length || 0} fonts detected
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleViewResults(item.id)}
                  >
                    View Results
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleExportCsv(item.id)}
                        disabled={item.status !== 'completed'}
                      >
                        <FileDownIcon className="mr-2 h-4 w-4" />
                        Export to CSV
                      </DropdownMenuItem>
                      {/* Only show delete option if inspection is NOT part of a project */}
                      {!item.projectId && (
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteInspection(item.id)}
                        >
                          <Trash2Icon className="mr-2 h-4 w-4" />
                          Delete Inspection
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No inspections match your filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <Select 
                value={String(itemsPerPage)} 
                onValueChange={(value: string) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }} 
                      className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((page, index) => 
                    page === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          href="#" 
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            setCurrentPage(Number(page));
                          }}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                inspection and remove the data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
} 