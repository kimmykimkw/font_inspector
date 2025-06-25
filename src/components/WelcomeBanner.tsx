"use client";

import Image from "next/image";

export function WelcomeBanner() {
  return (
    <div className="w-full text-center mb-8">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Image src="/logo.svg" alt="Font Inspector Logo" width={56} height={56} />
        <h1 className="text-4xl font-bold tracking-tight">Font Inspector</h1>
      </div>
      <p className="mt-4 text-lg text-neutral-600">
        Analyze websites and discover which font files are downloaded and actively used.
      </p>
    </div>
  );
} 