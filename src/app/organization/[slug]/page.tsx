"use client";

import React from 'react';
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { OrganizationSwitcherComponent } from "@/components/organization-switcher";
import { CalendarView } from "@/components/calendar-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
 


export default function OrganizationPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useUser();

  // Load organization by slug directly from Convex (no dependency on Clerk active org)
  const convexOrg = useQuery(api.organizations.getOrganizationBySlug, { slug });

  // Get organization members with user role
  const organizationMembers = useQuery(
    api.organizations.getOrganizationMembers,
    convexOrg ? { organizationId: convexOrg._id } : "skip"
  );

  // Get current user's role in this organization
  const userMembership = organizationMembers?.find(member => member.userId === user?.id);
  const userRole = userMembership?.role || "member";

  if (convexOrg === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!convexOrg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Project Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <OrganizationSwitcherComponent />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">{convexOrg.name}</h1>
              <OrganizationSwitcherComponent currentOrganization={convexOrg} />
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/project/${convexOrg.slug}/settings`}>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {organizationMembers && (
          <CalendarView 
            organizationId={convexOrg._id}
            organizationMembers={organizationMembers}
          />
        )}
      </main>
    </div>
  );
}

