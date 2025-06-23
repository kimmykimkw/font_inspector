import React from "react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
}

export function ExternalLink({ 
  href, 
  className, 
  children, 
  ...props 
}: ExternalLinkProps) {
  return (
    <a 
      href={href} 
      className={cn("text-primary", className)}
      target="_blank" 
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
} 