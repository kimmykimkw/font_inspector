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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToQueue } = useInspection();
  const permissions = useUserPermissions();

  const addUrlField = () => {
    setUrls([...urls, ""]);
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
      // For single URL, redirect to analyze page
      if (validUrls.length === 1) {
        const url = encodeURIComponent(validUrls[0]);
        window.location.href = `/analyze?url=${url}&type=single`;
      } else {
        // For multiple URLs, still use the old queue system for now
        await addToQueue(validUrls);
        toast.success(`Added ${validUrls.length} URLs to inspection queue`);
        // Reset the form to a single empty URL input
        setUrls([""]);
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