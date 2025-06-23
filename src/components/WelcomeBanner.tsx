"use client";

import { Type } from "lucide-react";

export function WelcomeBanner() {
  return (
    <div className="w-full text-center mb-8">
      <div className="flex items-center justify-center gap-3 mb-4">
        <Type className="h-8 w-8 text-neutral-700" />
        <h1 className="text-4xl font-bold tracking-tight">Font Inspector by Kimmy</h1>
      </div>
      <p className="mt-4 text-lg text-neutral-600">
        Analyze websites and discover which font files are downloaded and actively used.
      </p>
    </div>
  );
} 