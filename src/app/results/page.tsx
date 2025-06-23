"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper function to format dates consistently
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} at ${hours}:${minutes}`;
};

// Mock data for demonstration purposes
const mockInspectionData = {
  id: "insp_123456",
  url: "https://example.com",
  inspectedAt: new Date(),
  status: "completed",
  summary: {
    totalFonts: 5,
    totalSize: "256KB",
    loadTime: "1.2s",
    mostUsedFonts: [
      { name: "Roboto", count: 42 },
      { name: "Open Sans", count: 18 },
      { name: "Lato", count: 7 }
    ]
  },
  downloadedFonts: [
    { 
      name: "Roboto-Regular", 
      format: "woff2", 
      size: "48KB", 
      url: "/fonts/roboto.woff2",
      sourceUrl: "https://fonts.googleapis.com/css2?family=Roboto",
      provider: "Google Fonts"
    },
    { 
      name: "OpenSans-Bold", 
      format: "woff2", 
      size: "52KB", 
      url: "/fonts/opensans-bold.woff2",
      sourceUrl: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@700",
      provider: "Google Fonts"
    },
    { 
      name: "Lato-Light", 
      format: "woff", 
      size: "75KB", 
      url: "/fonts/lato-light.woff",
      sourceUrl: "https://use.typekit.net/abc123.css",
      provider: "Adobe Fonts"
    },
    { 
      name: "Montserrat-Medium", 
      format: "ttf", 
      size: "61KB", 
      url: "/fonts/montserrat.ttf",
      sourceUrl: "https://cdn.example.com/fonts/montserrat.ttf",
      provider: "Custom CDN"
    },
    { 
      name: "Poppins-Regular", 
      format: "woff2", 
      size: "44KB", 
      url: "/fonts/poppins.woff2",
      sourceUrl: "https://example.com/assets/fonts/poppins.woff2",
      provider: "Self-hosted"
    },
  ],
  activeFonts: [
    { name: "Roboto", weight: "400", style: "normal", elements: ["body", "p", ".content"] },
    { name: "Open Sans", weight: "700", style: "normal", elements: ["h1", "h2", ".title"] },
    { name: "Lato", weight: "300", style: "normal", elements: [".subtitle", "blockquote"] },
  ],
  logs: [
    { type: "network", message: "Downloaded font: Roboto-Regular.woff2", timestamp: new Date().toISOString() },
    { type: "css", message: "@font-face { font-family: 'Roboto'; src: url(...) }", timestamp: new Date().toISOString() },
    { type: "dom", message: "Applied font: Roboto to <body>", timestamp: new Date().toISOString() },
  ]
};

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState("summary");
  const inspectionData = mockInspectionData; // In a real app, this would come from API or params
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Inspection Results</h1>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => console.log("Export JSON")}>
              Export JSON
            </Button>
            <Button variant="outline" onClick={() => console.log("Export CSV")}>
              Export CSV
            </Button>
            <Button onClick={() => console.log("Share Results")}>
              Share Results
            </Button>
          </div>
        </div>

        {/* Inspection Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {inspectionData.url}
            </CardTitle>
            <CardDescription>
              Inspected on {isClient ? formatDate(inspectionData.inspectedAt) : ''}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tabs for Results Sections */}
        <Tabs defaultValue="summary" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="fonts">Downloaded Fonts</TabsTrigger>
            <TabsTrigger value="active">Active Fonts</TabsTrigger>
            <TabsTrigger value="logs">Inspection Log</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Summary</CardTitle>
                <CardDescription>Overview of inspection results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-lg">
                    <span className="text-3xl font-bold">{inspectionData.summary.totalFonts}</span>
                    <span className="text-sm text-muted-foreground">Total Fonts</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-lg">
                    <span className="text-3xl font-bold">{inspectionData.summary.totalSize}</span>
                    <span className="text-sm text-muted-foreground">Total Size</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-lg">
                    <span className="text-3xl font-bold">{inspectionData.summary.loadTime}</span>
                    <span className="text-sm text-muted-foreground">Load Time</span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-3">Most Used Fonts</h3>
                  <div className="border rounded-md">
                    <div className="grid grid-cols-2 font-medium p-3 border-b bg-slate-50">
                      <div>Font Name</div>
                      <div>Usage Count</div>
                    </div>
                    {inspectionData.summary.mostUsedFonts.map((font, index) => (
                      <div key={index} className="grid grid-cols-2 p-3 border-b last:border-0">
                        <div className="font-medium">{font.name}</div>
                        <div>{font.count} elements</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Downloaded Fonts Tab */}
          <TabsContent value="fonts">
            <Card>
              <CardHeader>
                <CardTitle>Font Download Details</CardTitle>
                <CardDescription>Files downloaded by the website</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <div className="grid grid-cols-6 font-medium p-3 border-b bg-slate-50">
                    <div>Font Name</div>
                    <div>Format</div>
                    <div>Size</div>
                    <div>Provider</div>
                    <div>Source URL</div>
                    <div>Actions</div>
                  </div>
                  {inspectionData.downloadedFonts.map((font, index) => (
                    <div key={index} className="grid grid-cols-6 p-3 border-b last:border-0">
                      <div className="font-medium">{font.name}</div>
                      <div>{font.format}</div>
                      <div>{font.size}</div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          font.provider === "Google Fonts" 
                            ? "bg-blue-100 text-blue-800" 
                            : font.provider === "Adobe Fonts"
                            ? "bg-red-100 text-red-800"
                            : font.provider === "Self-hosted"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {font.provider}
                        </span>
                      </div>
                      <div className="truncate text-xs">
                        <a href={font.sourceUrl} className="text-blue-600 hover:underline truncate" target="_blank" rel="noopener noreferrer">
                          {font.sourceUrl}
                        </a>
                      </div>
                      <div>
                        <Button variant="outline" size="sm">View Details</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Fonts Tab */}
          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Active Fonts</CardTitle>
                <CardDescription>Fonts actively used on the page</CardDescription>
              </CardHeader>
              <CardContent>
                {inspectionData.activeFonts.map((font, index) => (
                  <div key={index} className="mb-6 last:mb-0">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">{font.name}</h3>
                      <div className="text-sm text-muted-foreground">
                        Weight: {font.weight} | Style: {font.style}
                      </div>
                    </div>
                    <div className="bg-slate-100 p-4 rounded-md mb-2">
                      <p style={{ fontFamily: font.name, fontWeight: font.weight, fontStyle: font.style }} 
                         className="text-xl">
                        The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Applied to: <code>{font.elements.join(', ')}</code>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inspection Log Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Inspection Log</CardTitle>
                <CardDescription>Detailed log of the inspection process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <div className="grid grid-cols-3 font-medium p-3 border-b bg-slate-50">
                    <div>Type</div>
                    <div>Message</div>
                    <div>Timestamp</div>
                  </div>
                  {inspectionData.logs.map((log, index) => (
                    <div key={index} className="grid grid-cols-3 p-3 border-b last:border-0">
                      <div className="font-medium capitalize">{log.type}</div>
                      <div className="font-mono text-sm">{log.message}</div>
                      <div className="text-sm text-muted-foreground">
                        {isClient ? new Date(log.timestamp).toLocaleTimeString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">Download Full Log</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 