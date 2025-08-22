"use client";

import React from 'react';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useOrganization, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { OrganizationSwitcherComponent } from "@/components/organization-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Settings, Plus, Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
 

export default function Home() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();

  // Redirect to onboarding if user doesn't have first/last name
  React.useEffect(() => {
    if (userLoaded && user && (!user.firstName || !user.lastName)) {
      router.push('/onboarding');
    } else if (userLoaded && user && user.firstName && user.lastName) {
      // Sync user data to Convex when they have complete profile
      fetch('/api/profile/sync-to-convex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(console.error);
    }
  }, [user, userLoaded, router]);

  const userOrganizations = useQuery(
    api.organizations.getUserOrganizations,
    user && user.id ? { userId: user.id } : "skip"
  );

  // Use the authenticated user's actual ID from Clerk
  const actualUserOrganizations = useQuery(
    api.organizations.getUserOrganizations,
    user && user.id ? { userId: user.id } : "skip"
  );

  // Debug logging
  React.useEffect(() => {
    console.log("Debug - user:", user?.id);
    console.log("Debug - user object:", user);
    console.log("Debug - userLoaded:", userLoaded);
    console.log("Debug - query condition (user && user.id):", user && user.id);
    console.log("Debug - userOrganizations:", userOrganizations);
    console.log("Debug - actualUserOrganizations:", actualUserOrganizations);
    console.log("Debug - userOrganizations type:", typeof userOrganizations);
    console.log("Debug - userOrganizations === undefined:", userOrganizations === undefined);
    console.log("Debug - userOrganizations === null:", userOrganizations === null);
    if (userOrganizations) {
      console.log("Debug - userOrganizations.length:", userOrganizations.length);
    }
    if (actualUserOrganizations) {
      console.log("Debug - actualUserOrganizations.length:", actualUserOrganizations.length);
    }
  }, [user, userLoaded, userOrganizations, actualUserOrganizations]);

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
                Welcome back, {user?.firstName || user?.emailAddresses[0]?.emailAddress}!
              </h2>
              <p className="text-lg text-muted-foreground">
                Choose a project to view its schedule or create a new one.
              </p>
              
            </div>

            {(userOrganizations && Array.isArray(userOrganizations) && userOrganizations.length > 0) || 
             (actualUserOrganizations && Array.isArray(actualUserOrganizations) && actualUserOrganizations.length > 0) ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Your Projects</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(userOrganizations || actualUserOrganizations || []).map((org) => (
                    <Card key={org?._id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <Link href={`/organization/${org?.slug}`}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            {org?.imageUrl ? (
                              <img src={org.imageUrl} alt={org.name} className="w-8 h-8 rounded" />
                            ) : (
                              <Building2 className="h-8 w-8 text-blue-500" />
                            )}
                            {org?.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span className="capitalize">{org?.role}</span>
                            <span>
                              Joined {new Date(org?.joinedAt || 0).toLocaleDateString()}
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
                    {userOrganizations === undefined ? "Loading Projects..." : "No Projects Yet"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  {userOrganizations === undefined ? (
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
                    Debug: userOrganizations = {JSON.stringify(userOrganizations)}<br/>
                    Debug: actualUserOrganizations = {JSON.stringify(actualUserOrganizations)}
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
