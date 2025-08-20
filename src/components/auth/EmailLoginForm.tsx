'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, Mail, Lock, Eye, EyeOff, ArrowLeft, RotateCcw } from 'lucide-react';

interface EmailLoginFormProps {
  onSuccess: () => void;
  onSwitchToGoogle: () => void;
  onSwitchToRegister: () => void;
}

export function EmailLoginForm({ onSuccess, onSwitchToGoogle, onSwitchToRegister }: EmailLoginFormProps) {
  const { signInWithEmail, resetPassword, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim() || !formData.password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSigningIn(true);

    try {
      await signInWithEmail(formData.email, formData.password);
      toast.success('Signed in successfully!');
      onSuccess();
    } catch (error) {
      console.error('Email sign-in error:', error);
      toast.error(error instanceof Error ? error.message : 'Sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsResettingPassword(true);

    try {
      await resetPassword(formData.email);
      toast.success('Password reset email sent!', {
        description: 'Check your email for instructions to reset your password.'
      });
      setShowResetForm(false);
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (showResetForm) {
    return (
      <Card className="w-full border border-gray-200 bg-transparent">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your email address to receive password reset instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reset-email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                  disabled={isResettingPassword}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                type="submit" 
                className="w-full h-10 text-sm"
                disabled={isResettingPassword}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {isResettingPassword ? 'Sending...' : 'Send Reset Email'}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-10 text-sm"
                onClick={() => setShowResetForm(false)}
                disabled={isResettingPassword}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto border border-gray-200 bg-transparent">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">Sign In</CardTitle>
        <CardDescription>
          Sign in to your Font Inspector account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="pl-10"
                disabled={isSigningIn || loading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="pl-10 pr-10"
                disabled={isSigningIn || loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={isSigningIn || loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowResetForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              disabled={isSigningIn || loading}
            >
              Forgot password?
            </button>
          </div>

          <div className="space-y-3">
            <Button 
              type="submit" 
              className="w-full h-10 text-sm"
              disabled={isSigningIn || loading}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {isSigningIn ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>

        <div className="mt-6 space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="outline" 
            className="w-full h-10 text-sm"
            onClick={onSwitchToGoogle}
            disabled={isSigningIn || loading}
          >
            Continue with Google
          </Button>
          
          <div className="text-center">
            <span className="text-sm text-gray-600">Don't have an account? </span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              disabled={isSigningIn || loading}
            >
              Create one
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
