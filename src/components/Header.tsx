"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth/AuthButton";
import { useAuth } from "@/contexts/AuthContext";
import { Home, History, Info, HelpCircle } from "lucide-react";
import Image from "next/image";

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="w-full border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-bold text-xl flex items-center gap-1">
            <Image src="/fontinspector_logo.png" alt="Font Inspector Logo" width={40} height={40} />
            Font Inspector
          </Link>
        </div>
        {/* Draggable spacer area */}
        <div className="flex-1 min-h-[16px]" />
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive("/") ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            {user && (
              <Link 
                href="/history" 
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive("/history") ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <History className="h-4 w-4" />
                History
              </Link>
            )}
            <Link 
              href="/about" 
              className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive("/about") ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Info className="h-4 w-4" />
              About
            </Link>
            <Link 
              href="/help" 
              className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive("/help") ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              Help
            </Link>
          </nav>
          <AuthButton />
        </div>
      </div>
    </header>
  );
} 