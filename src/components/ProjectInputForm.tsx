import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useInspection } from '@/contexts/InspectionContext';
import { useUserPermissions } from '@/lib/user-permissions';
import { toast } from 'sonner';
import { AlertCircle, FolderPlus, Link, Search, Loader2 } from 'lucide-react';

export default function ProjectInputForm() {
  const [projectTitle, setProjectTitle] = useState('');
  const [urls, setUrls] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToQueue } = useInspection();
  const permissions = useUserPermissions();

  const validateUrls = (text: string) => {
    const urlArray = text.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlArray.length === 0) {
      return { valid: false, message: 'Please enter at least one URL to inspect.' };
    }

    // Limit to 15 websites per project
    if (urlArray.length > 15) {
      return { valid: false, message: `Too many websites. Please limit to 15 websites per project. You have entered ${urlArray.length} websites.` };
    }

    for (const url of urlArray) {
      try {
        // Prepend https:// if no protocol is specified (for the purpose of validation)
        const urlToTest = url.match(/^https?:\/\//) ? url : `https://${url}`;
        new URL(urlToTest);
      } catch (e) {
        return { valid: false, message: `Invalid URL format: ${url}` };
      }
    }

    return { valid: true, urls: urlArray };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check permissions before proceeding
    if (!permissions.canCreateProject) {
      toast.error(permissions.projectMessage || "You don't have permission to create projects");
      return;
    }

    if (!projectTitle.trim()) {
      setError('Please enter a project title.');
      return;
    }

    const validation = validateUrls(urls);
    
    if (!validation.valid) {
      setError(validation.message || 'Invalid URL format');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Redirect to analyze page for project analysis
      const urlsParam = encodeURIComponent((validation.urls as string[]).join(','));
      const projectNameParam = encodeURIComponent(projectTitle);
      window.location.href = `/analyze?type=project&projectName=${projectNameParam}&urls=${urlsParam}`;
    } catch (err) {
      setError('Failed to submit inspection request. Please try again.');
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Create Project
        </CardTitle>
        <CardDescription>
          Group multiple website inspections into a single project.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center p-3 text-sm rounded-md bg-destructive/15 text-destructive">
              <AlertCircle className="h-4 w-4 mr-2" />
              <p>{error}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="projectTitle" className="text-sm font-medium flex items-center gap-2">
              <FolderPlus className="h-4 w-4" />
              Project Title
            </label>
            <Input
              id="projectTitle"
              placeholder="My Font Inspection Project"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              disabled={!permissions.canCreateProject && !permissions.isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="urls" className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              URLs to Inspect
            </label>
            <div className="flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 shadow-xs">
              <textarea
                id="urls"
                className="flex-1 bg-transparent outline-none resize-none placeholder:text-muted-foreground disabled:opacity-50"
                placeholder="Enter URLs to inspect (one per line)
example.com
another-site.org"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={5}
                disabled={!permissions.canCreateProject && !permissions.isLoading}
              />
            </div>
          </div>
        </CardContent>
        <br />
        <CardFooter className="flex flex-col gap-3">
          {permissions.isLoading ? (
            <div className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking permissions...
            </div>
          ) : !permissions.canCreateProject ? (
            <div className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{permissions.projectMessage}</span>
            </div>
          ) : (
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {isSubmitting ? 'Creating Project...' : 'Create Project & Inspect'}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
} 