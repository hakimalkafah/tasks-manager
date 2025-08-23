"use client";

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const submittingRef = React.useRef(false);

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  // If user already has first and last name, redirect to home
  React.useEffect(() => {
    if (user?.firstName && user?.lastName) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user?.firstName, user?.lastName, router]);
  
  // Don't render anything if user is already onboarded
  if (user?.firstName && user?.lastName) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isUpdating) {
      console.log('Submit ignored: already submitting');
      return;
    }
    
    if (!firstName.trim() || !lastName.trim()) {
      alert('Please enter both first and last name');
      return;
    }

    setIsUpdating(true);
    submittingRef.current = true;

    try {
      // Update name via API route which also syncs to Convex
      const res = await fetch('/api/profile/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });

      if (!res.ok) {
        let message = 'Failed to update profile';
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {}
        throw new Error(message);
      }

      // Ensure the user object reflects the latest data
      try {
        await user.reload();
      } catch (error) {
        console.warn('Could not reload user session:', error);
      }

      // Mark as just onboarded to avoid redirect loop on home
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('justOnboarded', '1');
        }
      } catch {}

      // Force redirect regardless to avoid being stuck on onboarding
      setTimeout(() => {
        router.push('/?justOnboarded=1');
      }, 200);

      // Safety: if for any reason we didn't navigate off the page quickly,
      // re-enable the form so the UI isn't frozen
      setTimeout(() => {
        submittingRef.current = false;
        setIsUpdating(false);
      }, 2000);
    } catch (error) {
      console.error('Error updating user profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to update profile. Please try again.');
      // Only clear submitting flags on error
      submittingRef.current = false;
      setIsUpdating(false);
    } finally {
      // On success, keep flags true to avoid duplicate submits while redirecting
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Complete Your Profile</CardTitle>
          <p className="text-center text-gray-600">
            Please provide your first and last name to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isUpdating || !firstName.trim() || !lastName.trim()}
            >
              {isUpdating ? 'Updating...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
