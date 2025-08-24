"use client";

import React from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useOrganization, useUser } from "@clerk/nextjs";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { OrganizationSwitcherComponent } from "@/components/organization-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Settings, Plus, Building2, Crown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
 

export default function Home() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { user, isLoaded: userLoaded } = useUser();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();

  const convexUser = useQuery(
    api.users.getUserByClerkId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  // Redirect to onboarding if user doesn't have first/last name
  React.useEffect(() => {
    if (!userLoaded) return;
    if (!user) return;
    if (convexUser === undefined) return;
    const win = typeof window !== 'undefined' ? window : undefined;
    const sp = win ? new URLSearchParams(win.location.search) : undefined;
    const justOnboarded = (sp?.get('justOnboarded') === '1') || (win?.sessionStorage.getItem('justOnboarded') === '1');

    const firstName = convexUser?.firstName || user.firstName;
    const lastName = convexUser?.lastName || user.lastName;

    if (!firstName || !lastName) {
      // Avoid immediate loop right after onboarding
      if (justOnboarded) {
        // Clean up flag and strip query param
        try { win?.sessionStorage.removeItem('justOnboarded'); } catch {}
        // Replace URL without query if present
        if (sp && sp.has('justOnboarded')) {
          router.replace('/');
        }
        return;
      }
      router.push('/onboarding');
    } else {
      // Sync user data to Convex when they have complete profile
      if (!convexUser?.firstName || !convexUser?.lastName) {
        fetch('/api/profile/sync-to-convex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(console.error);
      }
    }
  }, [convexUser, user?.firstName, user?.lastName, userLoaded, router]);

  const canQueryUserOrgs = userLoaded && !!user?.id && isAuthenticated;
  const [refreshKey, setRefreshKey] = React.useState(0);
  
  // Force refresh user organizations when organization changes
  React.useEffect(() => {
    if (organization) {
      setRefreshKey(prev => prev + 1);
    }
  }, [organization?.id]);

  // Add polling to refresh organizations periodically
  React.useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const userOrganizations = useQuery(
    api.organizations.getUserOrganizations,
    canQueryUserOrgs ? { userId: user.id } : "skip"
  );

  // Debug logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Debug - user:", user?.id);
      console.log("Debug - organization:", organization?.id);
      console.log("Debug - userOrganizations:", userOrganizations);
    }
  }, [user?.id, organization?.id, userOrganizations]);

  // Check if organization exists in Convex before redirecting
  const convexOrg = useQuery(
    api.organizations.getOrganization,
    organization ? { clerkOrgId: organization.id } : "skip"
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">Project Scheduler</h1>
          <div className="flex items-center gap-4">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <Button variant="outline">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button>Sign up</Button>
                </SignUpButton>
              </div>
            </SignedOut>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12">
        <SignedOut>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              Collaborative Task Management
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Schedule your team's work with powerful calendar-based tools. Create projects, assign events to team members, and coordinate schedules together.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Building2 className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Projects</h3>
                  <p className="text-sm text-muted-foreground">
                    Create and manage multiple projects with calendar-based scheduling.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Team Coordination</h3>
                  <p className="text-sm text-muted-foreground">
                    Invite team members, assign roles, and coordinate schedules together.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Calendar className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Calendar Scheduling</h3>
                  <p className="text-sm text-muted-foreground">
                    Create, assign, and track events with calendar-based scheduling and time management.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-4 justify-center">
              <SignUpButton mode="modal">
                <Button size="lg">Get Started</Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button size="lg" variant="outline">Sign In</Button>
              </SignInButton>
            </div>
          </div>
        </SignedOut>
        
        <SignedIn>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Welcome back, {convexUser?.firstName || user?.firstName || user?.emailAddresses[0]?.emailAddress}!
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose a project to view its schedule or create a new one.
              </p>
              
            </div>

            {(userOrganizations && Array.isArray(userOrganizations) && userOrganizations.length > 0) ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Your Projects</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(userOrganizations || [])
                    .filter(org => org) // Filter out any null/undefined orgs
                    .sort((a, b) => {
                      // Sort by role (admin first) and then by name
                      if (a.role === b.role) {
                        return a.name.localeCompare(b.name);
                      }
                      return a.role === 'admin' ? -1 : 1;
                    })
                    .map((org) => (
                      <Card key={org._id} className="hover:shadow-md transition-shadow cursor-pointer group">
                        <Link href={`/organization/${org.slug}`} className="block h-full">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              {org.imageUrl ? (
                                <img 
                                  src={org.imageUrl} 
                                  alt={org.name} 
                                  className="w-8 h-8 rounded" 
                                  onError={(e) => {
                                    // Fallback to icon if image fails to load
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <Building2 className={`h-8 w-8 ${org.imageUrl ? 'hidden' : ''} ${org.role === 'admin' ? 'text-yellow-500' : 'text-blue-500'}`} />
                              <span className="truncate">{org.name}</span>
                              {org.role === 'admin' && (
                                <Crown className="h-4 w-4 text-yellow-500" />
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <Badge variant={org.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                {org.role}
                              </Badge>
                              <span className="text-xs">
                                Joined {new Date(org.joinedAt || org.createdAt || 0).toLocaleDateString()}
                              </span>
                            </div>
                          </CardContent>
                        </Link>
                      </Card>
                    ))}
                </div>
              </div>
            ) : (
              <Card className="max-w-md mx-auto">
                <CardHeader>
                  <CardTitle className="text-center">
                    {userOrganizations === undefined || authLoading || !isAuthenticated ? "Loading Projects..." : "No Projects Yet"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  {userOrganizations === undefined || authLoading || !isAuthenticated ? (
                    <p className="text-muted-foreground mb-6">
                      Loading your projects...
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-6">
                        Create your first project to start scheduling events with your team.
                      </p>
                      <OrganizationSwitcherComponent />
                    </>
                  )}
                  <div className="mt-4 text-xs text-gray-500">
                    Debug: userOrganizations = {JSON.stringify(userOrganizations)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </SignedIn>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          {new Date().getFullYear()} Project Scheduler. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
