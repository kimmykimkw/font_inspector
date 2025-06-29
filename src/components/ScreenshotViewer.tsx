"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Camera, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Loader2,
  AlertCircle,
  ImageIcon
} from "lucide-react";

interface ScreenshotData {
  original: string;
  annotated: string;
  capturedAt: Date | string;
  dimensions?: {
    width: number;
    height: number;
  };
  annotationCount?: number;
}

interface ScreenshotViewerProps {
  inspectionId: string;
  screenshots?: ScreenshotData;
  url: string;
}

export function ScreenshotViewer({ inspectionId, screenshots, url }: ScreenshotViewerProps) {
  const [screenshotImages, setScreenshotImages] = useState<{
    original: string | null;
    annotated: string | null;
  }>({ original: null, annotated: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'annotated'>('annotated');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const loadScreenshots = async () => {
      if (!screenshots) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if we're in Electron environment
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          // Load screenshots from local files
          const electronAPI = (window as any).electronAPI;
          const [original, annotated] = await Promise.all([
            electronAPI.getScreenshot(screenshots.original),
            electronAPI.getScreenshot(screenshots.annotated)
          ]);

          setScreenshotImages({
            original: original ? `data:image/png;base64,${original}` : null,
            annotated: annotated ? `data:image/png;base64,${annotated}` : null
          });
        } else {
          // Fallback for non-Electron environment
          setError('Screenshots are only available in the desktop application');
        }
      } catch (error) {
        console.error('Error loading screenshots:', error);
        setError('Failed to load screenshots');
      } finally {
        setLoading(false);
      }
    };

    loadScreenshots();
  }, [screenshots]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.25));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownloadScreenshot = async (type: 'original' | 'annotated') => {
    const imageData = screenshotImages[type];
    if (!imageData) {
      toast.error('Screenshot not available');
      return;
    }

    try {
      // Create download link
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `font-inspector-${type}-${inspectionId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${type === 'original' ? 'Original' : 'Annotated'} screenshot downloaded`);
    } catch (error) {
      console.error('Error downloading screenshot:', error);
      toast.error('Failed to download screenshot');
    }
  };

  const formatCaptureTime = (capturedAt: Date | string) => {
    const date = typeof capturedAt === 'string' ? new Date(capturedAt) : capturedAt;
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!screenshots) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Screenshots
          </CardTitle>
          <CardDescription>
            Screenshots are not available for this inspection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No screenshots captured for this inspection</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Screenshots
          </CardTitle>
          <CardDescription>
            Captured on {formatCaptureTime(screenshots.capturedAt)}
            {screenshots.annotationCount && ` • ${screenshots.annotationCount} font annotations`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading screenshots...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Screenshots
          </CardTitle>
          <CardDescription>
            Error loading screenshots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-destructive">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentImage = screenshotImages[activeTab];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Screenshots
            </CardTitle>
            <CardDescription>
              Captured on {formatCaptureTime(screenshots.capturedAt)}
              {screenshots.annotationCount && ` • ${screenshots.annotationCount} font annotations`}
              {screenshots.dimensions && 
                ` • ${screenshots.dimensions.width}×${screenshots.dimensions.height}px`
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 5}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetZoom}
              disabled={zoom === 1 && position.x === 0 && position.y === 0}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'original' | 'annotated')}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="annotated">
                Font Annotations
                {screenshots.annotationCount && (
                  <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                    {screenshots.annotationCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadScreenshot(activeTab)}
              disabled={!currentImage}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          <TabsContent value="original" className="mt-0">
            <div className="border rounded-lg overflow-auto bg-muted/50">
              {screenshotImages.original ? (
                <div 
                  className="relative"
                  style={{ 
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    src={screenshotImages.original}
                    alt={`Original screenshot of ${url}`}
                    className="w-full transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                      transformOrigin: 'top left'
                    }}
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Original screenshot not available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="annotated" className="mt-0">
            <div className="border rounded-lg overflow-auto bg-muted/50">
              {screenshotImages.annotated ? (
                <div 
                  className="relative"
                  style={{ 
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    src={screenshotImages.annotated}
                    alt={`Annotated screenshot of ${url} showing font usage`}
                    className="w-full transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                      transformOrigin: 'top left'
                    }}
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Annotated screenshot not available
                </div>
              )}
            </div>
            {screenshots.annotationCount && screenshots.annotationCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Colored boxes and labels indicate where specific fonts are used on the page.
                Each color represents a different font family.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 