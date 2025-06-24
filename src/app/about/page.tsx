import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Globe, FileText, Target, BarChart3, Info, Monitor, Shield, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-3">
            About Font Inspector
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <p className="text-muted-foreground">
              Font Inspector is a <strong>Desktop Application</strong> that analyzes websites and reports which font files are downloaded and actively used. 
              The tool utilizes a headless browser to inspect the network requests of a given website, filters font-related assets, and provides insights by comparing CSS declarations with actual applied fonts. 
              The app supports both individual website inspections and projects containing multiple websites, offering a user-friendly desktop interface, robust backend inspection, and native macOS integration with proper permission handling.
            </p>
          </section>

          <section>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium flex items-center gap-2 mb-2 text-blue-800">
                <Monitor className="h-5 w-5" />
                Browser Requirement
              </h3>
              <p className="text-blue-700">
                <strong>Chrome browser is required</strong> to use Font Inspector. Please ensure you have Google Chrome installed on your system before running inspections.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
              How It Works
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Website Inspection
                </h3>
                <p className="text-muted-foreground">
                  Font Inspector utilizes a headless browser to load your specified websites and intercept all network requests,
                  focusing on font-related assets (WOFF, WOFF2, TTF, etc.).
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  CSS Analysis
                </h3>
                <p className="text-muted-foreground">
                  The tool extracts and analyzes @font-face declarations to identify which fonts are intended to be used
                  across the website, providing comprehensive font usage insights.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Usage Detection
                </h3>
                <p className="text-muted-foreground">
                  By evaluating computed styles in the DOM, Font Inspector determines which fonts are actually
                  being applied to elements, providing insights into font fallbacks and unused font files.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Results Aggregation
                </h3>
                <p className="text-muted-foreground">
                  All collected data is processed and presented in an easy-to-understand format, highlighting
                  downloaded fonts, their sources, file sizes, and actual usage across the inspected websites.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
              Privacy & Security
            </h2>
            <p className="text-muted-foreground">
              Font Inspector requires Google authentication to ensure user data privacy and personalized experience. 
              Each user's inspections, projects, and history are completely isolated from other users. 
              All user data is securely stored and managed through Firebase, with robust authentication and access control.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">
              Team & Contact Information
            </h2>
            <p className="text-muted-foreground">
              Font Inspector is developed by Kimmy Kim. 
              For support, feedback, or questions, please reach out through the application's feedback channel on the <a href="/help" className="text-primary hover:underline">help page</a>.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
} 