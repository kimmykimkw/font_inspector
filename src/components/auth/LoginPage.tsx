'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Search, History, FolderOpen, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { RequestAccessDialog } from '@/components/RequestAccessDialog';

export function LoginPage() {
  const { signInWithGoogle, loading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showCancelTip, setShowCancelTip] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      setShowCancelTip(true); // Show cancel tip when authentication starts
      await signInWithGoogle();
    } catch (error: any) {
      setShowCancelTip(false); // Hide cancel tip when authentication fails
      
      let errorMessage = 'Failed to sign in. Please try again.';
      let shouldShowToast = true;
      
      // Handle authorization errors specifically
      if (error.message?.includes('Your account does not have access')) {
        errorMessage = 'Your account does not have access to Font Inspector. Please request access using the button below.';
        setAuthError(errorMessage);
        
        toast.error('Access Denied', {
          description: 'Please request access to use Font Inspector.',
          duration: 6000,
          style: {
            color: '#dc2626',
            fontWeight: '600'
          },
          descriptionClassName: 'text-gray-800 font-medium'
        });
        return; // Don't log this error or show additional toasts
      }
      
      // Handle other authentication errors
      if (error.message?.includes('popup') || error.message?.includes('blocked')) {
        errorMessage = 'Popup was blocked. The page will redirect for authentication.';
        toast.info('Popup blocked', {
          description: 'Redirecting to Google for authentication...',
          duration: 3000
        });
        shouldShowToast = false;
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Authentication popup was blocked. Redirecting instead...';
        toast.info('Redirecting for authentication', {
          description: 'Your browser blocked the popup, so we\'ll redirect you to sign in.',
          duration: 3000
        });
        shouldShowToast = false;
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Authentication was cancelled. You can try signing in again.';
        toast.info('Authentication cancelled', {
          description: 'Click "Sign in with Google" to try again.',
          duration: 3000
        });
        shouldShowToast = false;
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many sign-in attempts. Please try again later.';
      }
      
      setAuthError(errorMessage);
      
      // Show toast for errors that need additional notification
      if (shouldShowToast && !error.message?.includes('redirect')) {
        console.error('Authentication error:', error);
        toast.error('Authentication failed', {
          description: errorMessage,
          duration: 5000
        });
      }
    }
  };

  const handleCancelAuth = () => {
    setShowCancelTip(false);
    setAuthError(null);
    // Refresh the page to reset authentication state
    window.location.reload();
  };

  return (
    <div className="flex-1 flex items-center justify-center w-full">
      <div className="max-w-lg w-full mx-auto px-4">
        {/* Login card */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl">Font Inspector</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Error message */}
            {authError && (
              <div className="flex items-center space-x-3 p-4 text-sm bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <span className="text-red-900 font-semibold">{authError}</span>
              </div>
            )}

            {/* Cancel tip - shown during authentication */}
            {showCancelTip && loading && (
              <div className="flex items-center justify-between p-4 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <span>
                    If the popup doesn't appear or you want to cancel, click "Cancel" below.
                    You can also close the popup window directly.
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancelAuth}
                  className="ml-3 text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Feature list */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4 text-gray-700">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Inspect fonts on any website</span>
              </div>
              <div className="flex items-center space-x-4 text-gray-700">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium">Organize inspections into projects</span>
              </div>
              <div className="flex items-center space-x-4 text-gray-700">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <History className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium">Access your inspection history</span>
              </div>
            </div>

            {/* Sign in button */}
            <Button 
              onClick={handleSignIn} 
              disabled={loading}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              <LogIn className="w-5 h-5 mr-3" />
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>

            {/* Request Access Button */}
            <Button 
              onClick={() => setShowRequestDialog(true)}
              variant="outline"
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              <UserPlus className="w-5 h-5 mr-3" />
              Request Access
            </Button>

            {/* Browser notice */}
            <div className="text-xs text-gray-500 text-center space-y-2">
              <p className="leading-relaxed">
                Your data is private and secure. We only use your Google account for authentication.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Request Access Dialog */}
        <RequestAccessDialog 
          isOpen={showRequestDialog}
          onOpenChange={setShowRequestDialog}
        />
      </div>
    </div>
  );
} 