'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Search, History, FolderOpen, AlertCircle, UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { RequestAccessDialog } from '@/components/RequestAccessDialog';
import { EmailLoginForm } from './EmailLoginForm';
import { EmailRegistrationForm } from './EmailRegistrationForm';

type AuthMode = 'select' | 'google' | 'email-login' | 'email-register';

export function LoginPage() {
  const { signInWithGoogle, loading } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('select');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showCancelTip, setShowCancelTip] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  // Handle Google authentication when mode changes to 'google'
  React.useEffect(() => {
    if (authMode === 'google') {
      handleGoogleSignIn();
    }
  }, [authMode]);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      setShowCancelTip(true); // Show cancel tip when authentication starts
      await signInWithGoogle();
    } catch (error: any) {
      setShowCancelTip(false); // Hide cancel tip when authentication fails
      
      let errorMessage = 'Failed to sign in. Please try again.';
      
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
        return; // Don't show error for popup blocks
      }
      
      console.error('Authentication error:', error);
      setAuthError(errorMessage);
      
      toast.error('Authentication Failed', {
        description: errorMessage,
        duration: 5000
      });
    }
  };

  const handleAuthSuccess = () => {
    // Reset state and let the auth context handle navigation
    setAuthMode('select');
    setAuthError(null);
    setShowCancelTip(false);
  };

  // Render different authentication forms based on mode
  if (authMode === 'email-login') {
    return (
      <div className="min-h-screen bg-white flex flex-col px-4 pt-24">
        <div className="w-full max-w-5xl mx-auto">
          <EmailLoginForm
            onSuccess={handleAuthSuccess}
            onSwitchToGoogle={() => setAuthMode('google')}
            onSwitchToRegister={() => setAuthMode('email-register')}
          />
        </div>
      </div>
    );
  }

  if (authMode === 'email-register') {
    return (
      <div className="min-h-screen bg-white flex flex-col px-4 pt-24">
        <div className="w-full max-w-3xl mx-auto">
          <EmailRegistrationForm
            onSuccess={() => setAuthMode('select')}
            onCancel={() => setAuthMode('select')}
          />
        </div>
      </div>
    );
  }

  if (authMode === 'google') {
    return (
      <div className="min-h-screen bg-white flex flex-col px-4 pt-24">
        <div className="w-full max-w-3xl mx-auto">
          <Card className="w-full border border-gray-200 bg-transparent">
            <CardContent className="py-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Signing in with Google...</h3>
              <p className="text-gray-600">Please wait while we authenticate your account.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Default: Authentication method selection
  return (
    <div className="min-h-screen bg-white flex flex-col px-4 pt-24">
      <div className="w-full max-w-3xl mx-auto">
        <Card className="w-full border border-gray-200 bg-transparent">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Choose your sign-in method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Sign-In */}
            <Button 
              onClick={() => setAuthMode('google')} 
              variant="outline"
              className="w-full h-10 text-sm"
              disabled={loading}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with Google
            </Button>

            {/* Email Sign-In */}
            <Button 
              onClick={() => setAuthMode('email-login')} 
              variant="outline"
              className="w-full h-10 text-sm"
              disabled={loading}
            >
              <Mail className="w-4 h-4 mr-2" />
              Sign in with Email
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-500">
                  New user?
                </span>
              </div>
            </div>

            {/* Registration */}
            <Button 
              onClick={() => setAuthMode('email-register')} 
              className="w-full h-10 text-sm bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Account
            </Button>

            {/* Request Access (for Google users without access) */}
            <div className="text-center mt-4">
              <button
                onClick={() => setShowRequestDialog(true)} 
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                disabled={loading}
              >
                Request Access (Google Users)
              </button>
            </div>

          {/* Show authentication error */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-xs text-red-700">{authError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cancel tip for Google authentication */}
          {showCancelTip && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-700">
                    If you see a popup, please complete the sign-in process.
                  </p>
                </div>
              </div>
            </div>
          )}
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