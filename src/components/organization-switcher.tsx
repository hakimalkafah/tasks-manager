"use client";

import React from 'react';
import { OrganizationSwitcher } from "@clerk/nextjs";
import { useOrganization, useUser, useAuth } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

interface OrganizationSwitcherComponentProps {
  currentOrganization?: {
    _id: string;
    clerkOrgId: string;
    name: string;
    slug: string;
  };
}

export function OrganizationSwitcherComponent({ currentOrganization }: OrganizationSwitcherComponentProps = {}) {
  const { organization } = useOrganization();
  const { user } = useUser();
  const { orgId } = useAuth();
  const createOrganization = useMutation(api.organizations.createOrganization);
  
  // Sync organization with Convex when it changes
  useEffect(() => {
    const syncOrganization = async () => {
      if (organization && user) {
        const slug = organization.slug || organization.name.toLowerCase().replace(/\s+/g, '-');
        
        try {
          const result = await createOrganization({
            clerkOrgId: organization.id,
            name: organization.name,
            slug: slug,
            imageUrl: organization.imageUrl || undefined,
            createdBy: user.id,
          });
        } catch (error: any) {
          // Swallow sync errors to avoid noisy UI; consider adding toast in the future
        }
      }
    };

    if (organization && user) {
      syncOrganization();
    }
  }, [organization, user, createOrganization]);

  // Show organization name when we have a current organization but no active Clerk org
  const displayName = currentOrganization && (!organization || organization.id !== currentOrganization.clerkOrgId) 
    ? currentOrganization.name 
    : undefined;

  return (
    <div className="flex items-center">
      <OrganizationSwitcher
        appearance={{
          elements: {
            organizationSwitcherTrigger: "px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500",
            organizationSwitcherPopoverCard: "mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5",
          },
        }}
        createOrganizationMode="modal"
        organizationProfileMode="modal"
        afterCreateOrganizationUrl="/project/:slug"
        afterSelectOrganizationUrl="/project/:slug"
        afterSelectPersonalUrl="/dashboard"
      />
    </div>
  );
}
