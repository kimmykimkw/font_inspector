'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/lib/user-permissions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogIn, LogOut, User, Activity } from 'lucide-react';
import { toast } from 'sonner';

export function AuthButton() {
  const { user, userProfile, loading, signInWithGoogle, logout } = useAuth();
  const permissions = useUserPermissions();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Authentication error:', error);
      
      if (error.code === 'auth/popup-blocked' || 
          error.message?.includes('popup') || 
          error.message?.includes('blocked')) {
        toast.info('Redirecting for authentication', {
          description: 'Popup was blocked, redirecting to complete sign-in.',
          duration: 3000
        });
      } else {
        toast.error('Authentication failed', {
          description: 'Please try again or check your browser settings.',
          duration: 5000
        });
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <Button variant="ghost" disabled>
        Loading...
      </Button>
    );
  }

  if (!user) {
    return (
      <Button 
        onClick={handleSignIn} 
        variant="outline"
        disabled={isSigningIn}
      >
        <LogIn className="w-4 h-4 mr-2" />
        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
            <AvatarFallback>
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        {!permissions.isLoading && (permissions.inspectionLimit || permissions.projectLimit) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Usage This Month</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {permissions.inspectionLimit && (
                  <div>Inspections: {permissions.inspectionCount || 0}/{permissions.inspectionLimit}</div>
                )}
                {permissions.projectLimit && (
                  <div>Projects: {permissions.projectCount || 0}/{permissions.projectLimit}</div>
                )}
              </div>
            </div>
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 