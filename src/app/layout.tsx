import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";
import { InspectionProvider } from "@/contexts/InspectionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionManager } from "@/components/PermissionManager";
import { UpdateManager } from "@/components/UpdateManager";
import { StagewiseToolbar } from "@stagewise/toolbar-next";
import { ReactPlugin } from "@stagewise-plugins/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Font Inspector - Analyze Website Font Usage",
  description: "Analyze websites and discover which font files are downloaded and actively used",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased bg-gradient-to-br from-gray-50 via-white to-gray-100 electron-app`}
      >
        <AuthProvider>
          <InspectionProvider>
            <PermissionManager>
              <Header />
              <main className="flex-1 flex flex-col items-center p-4 sm:p-6 lg:p-8">
                {children}
              </main>
              <Footer />
              <UpdateManager />
              <Toaster />
              <StagewiseToolbar config={{ plugins: [ReactPlugin] }} />
            </PermissionManager>
          </InspectionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
