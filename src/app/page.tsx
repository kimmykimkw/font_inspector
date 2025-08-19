"use client";

import { WelcomeBanner } from "@/components/WelcomeBanner";
import { UrlInputForm } from "@/components/UrlInputForm";
import { InspectionQueue } from "@/components/InspectionQueue";
import ProjectInputForm from "@/components/ProjectInputForm";
import { ProjectList } from "@/components/ProjectList";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthWrapper } from "@/components/auth/AuthWrapper";
import { Globe, FolderPlus } from "lucide-react";

export default function Home() {
  return (
    <AuthWrapper>
      <div className="w-full max-w-3xl mx-auto">
        <WelcomeBanner />
        
        {/* Announcement Section */}
        <AnnouncementBanner className="mb-6" />
        
        <div className="flex flex-col gap-8 mb-8">
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Single URL
              </TabsTrigger>
              <TabsTrigger value="project" className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4" />
                Project
              </TabsTrigger>
            </TabsList>
            <TabsContent value="url">
              <UrlInputForm />
            </TabsContent>
            <TabsContent value="project">
              <ProjectInputForm />
            </TabsContent>
          </Tabs>
          
          <InspectionQueue />
          <ProjectList />
        </div>
      </div>
    </AuthWrapper>
  );
}
