"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { useInspection } from "@/contexts/InspectionContext";
import { useUserPermissions } from "@/lib/user-permissions";
import { toast } from "sonner";
import { Globe, Plus, X, Search, AlertCircle, Loader2 } from "lucide-react";

export function UrlInputForm() {
  const [urls, setUrls] = useState<string[]>([""]);
  const [pageCount, setPageCount] = useState<1 | 5 | 10>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToQueue } = useInspection();
  const permissions = useUserPermissions();

  const addUrlField = () => {
    setUrls([...urls, ""]);
    // Reset page count to 1 when adding multiple URLs
    setPageCount(1);
  };

  const removeUrlField = (index: number) => {
    if (urls.length > 1) {
      const newUrls = [...urls];
      newUrls.splice(index, 1);
      setUrls(newUrls);
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permissions before proceeding
    if (!permissions.canCreateInspection) {
      toast.error(permissions.inspectionMessage || "You don't have permission to create inspections");
      return;
    }
    
    // Filter out empty URLs
    const validUrls = urls.filter(url => url.trim() !== "");
    
    if (validUrls.length === 0) {
      toast.error("Please enter at least one valid URL");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Handle different page count scenarios
      if (validUrls.length === 1) {
        const url = encodeURIComponent(validUrls[0]);
        
        if (pageCount === 1) {
          // Single page inspection
          window.location.href = `/analyze?url=${url}&type=single`;
        } else {
          // Multi-page inspection - redirect to analyze page with page discovery
          window.location.href = `/analyze?url=${url}&type=multi-page&pageCount=${pageCount}`;
        }
      } else {
        // For multiple URLs, still use the old queue system for now
        await addToQueue(validUrls);
        toast.success(`Added ${validUrls.length} URLs to inspection queue`);
        // Reset the form to a single empty URL input
        setUrls([""]);
        setPageCount(1);
      }
    } catch (error) {
      toast.error("Failed to submit URLs");
      console.error("Error submitting URLs:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Inspect Websites
        </CardTitle>
        <CardDescription>
          Enter one or more website URLs to analyze font usage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Page Count Selection - only show for single URL */}
          {urls.length === 1 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-neutral-700">
                How many pages to inspect?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pageCount"
                    value="1"
                    checked={pageCount === 1}
                    onChange={() => setPageCount(1)}
                    className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 focus:ring-blue-500 focus:ring-2"
                    disabled={!permissions.canCreateInspection && !permissions.isLoading}
                  />
                  <span className="text-sm text-neutral-700">
                    1 page <span className="text-neutral-500">(this page only)</span>
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pageCount"
                    value="5"
                    checked={pageCount === 5}
                    onChange={() => setPageCount(5)}
                    className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 focus:ring-blue-500 focus:ring-2"
                    disabled={!permissions.canCreateInspection && !permissions.isLoading}
                  />
                  <span className="text-sm text-neutral-700">
                    5 pages <span className="text-neutral-500">(auto-discover)</span>
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pageCount"
                    value="10"
                    checked={pageCount === 10}
                    onChange={() => setPageCount(10)}
                    className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 focus:ring-blue-500 focus:ring-2"
                    disabled={!permissions.canCreateInspection && !permissions.isLoading}
                  />
                  <span className="text-sm text-neutral-700">
                    10 pages <span className="text-neutral-500">(auto-discover)</span>
                  </span>
                </label>
              </div>
              {pageCount > 1 && (
                <p className="text-xs text-neutral-600 bg-blue-50 p-2 rounded">
                  <AlertCircle className="inline w-3 h-3 mr-1" />
                  We'll automatically find {pageCount} relevant pages from the website and create a project for analysis.
                </p>
              )}
            </div>
          )}
          {urls.map((url, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isSubmitting && permissions.canCreateInspection) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                  required={index === 0}
                  className="pl-10"
                  disabled={!permissions.canCreateInspection && !permissions.isLoading}
                />
              </div>
              {urls.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeUrlField(index)}
                  className="shrink-0"
                  disabled={!permissions.canCreateInspection && !permissions.isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center gap-2"
            onClick={addUrlField}
            disabled={true}
            hidden={true}
          >
            <Plus className="h-4 w-4" />
            Add Another URL
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {permissions.isLoading ? (
          <div className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking permissions...
          </div>
        ) : !permissions.canCreateInspection ? (
          <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{permissions.inspectionMessage}</span>
          </div>
        ) : (
          <Button 
            type="submit" 
            className="w-full flex items-center gap-2" 
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            <Search className="h-4 w-4" />
            {isSubmitting ? "Analyzing..." : "Analyze Fonts"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 