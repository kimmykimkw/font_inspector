"use client";

import { getCurrentAppVersion } from '@/lib/version';

export function Footer() {
  return (
    <footer className="w-full border-t py-6 mt-auto">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <p className="text-sm text-neutral-500">
                         &copy; {new Date().getFullYear()} Font Inspector by Kimmy
          </p>
          <span className="text-sm text-neutral-400">v{getCurrentAppVersion()}</span>
        </div>
        <div className="flex gap-4">
          <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900">Privacy</a>
          <a href="#" className="text-sm text-neutral-500 hover:text-neutral-900">Terms</a>
        </div>
      </div>
    </footer>
  );
} 