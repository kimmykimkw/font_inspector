'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle, Mail, User, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

interface EmailRegistrationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmailRegistrationForm({ onSuccess, onCancel }: EmailRegistrationFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 6) {
      errors.push('At least 6 characters');
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Password validation
    const passwordErrors = validatePassword(formData.password);
    if (passwordErrors.length > 0) {
      toast.error(`Password must have: ${passwordErrors.join(', ')}`);
      return;
    }

    // Confirm password match
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/register-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit registration');
      }

      setIsSubmitted(true);
      toast.success('Registration request submitted successfully!', {
        description: 'We will review your request and notify you by email.'
      });
    } catch (error) {
      console.error('Error submitting registration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isSubmitted) {
    return (
      <Card className="w-96 mx-auto border border-gray-200 bg-transparent">
        <CardContent className="py-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Registration Submitted!</h3>
          <p className="text-sm text-gray-600 mb-4">
            Your registration request has been submitted successfully. An administrator will review your request and notify you once approved.
          </p>
          <Button onClick={onSuccess} className="w-full h-10 text-sm">
            Back to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  const passwordErrors = validatePassword(formData.password);
  const isPasswordValid = formData.password.length > 0 && passwordErrors.length === 0;

  return (
    <Card className="w-96 mx-auto border border-gray-200 bg-transparent">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">Create Account</CardTitle>
        <CardDescription>
          Register for Font Inspector with your email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="pl-10"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formData.password.length > 0 && (
              <div className="text-xs space-y-1">
                {passwordErrors.map((error, index) => (
                  <div key={index} className="flex items-center text-red-600">
                    <span className="w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                    {error}
                  </div>
                ))}
                {isPasswordValid && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-3 h-3 mr-2" />
                    Password meets requirements
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="pl-10 pr-10"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formData.confirmPassword.length > 0 && (
              <div className="text-xs">
                {formData.password === formData.confirmPassword ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="w-3 h-3 mr-2" />
                    Passwords match
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <span className="w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                    Passwords do not match
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Your registration will be reviewed by an administrator. 
              You'll receive an email notification once your account is approved.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              type="submit" 
              className="w-full h-10 text-sm"
              disabled={isSubmitting || !isPasswordValid || formData.password !== formData.confirmPassword}
            >
              {isSubmitting ? 'Submitting...' : 'Create Account'}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-10 text-sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
