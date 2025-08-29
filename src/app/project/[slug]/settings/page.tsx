"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  useOrganization,
  useOrganizationList,
} from "@clerk/nextjs";
import { CreateProjectButton } from "@/components/create-project-button";
import { Button } from "@/components/ui/button";

import OrganizationSettingsPage from "../../../organization/[slug]/settings/page";

export default function ProjectSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const convexOrg = useQuery(api.organizations.getOrganizationBySlug, { slug });
  const { organization, isLoaded } = useOrganization();
  const { setActive } = useOrganizationList();

  useEffect(() => {
    if (convexOrg && setActive) {
      // Ensure the Clerk active organization matches the project slug
      setActive({ organization: convexOrg.clerkOrgId }).catch(() => {});
    }
  }, [convexOrg, setActive]);

  if (convexOrg === undefined || !isLoaded) {
    return <div>Loading...</div>;
  }

  if (!convexOrg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">No Project Selected</h2>
          <p className="text-gray-600 mb-4">
            Please select or create a project to continue.
          </p>
          <div className="flex items-center gap-2">
            <CreateProjectButton />
            <Link href="/">
              <Button variant="outline">Back to Projects</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!organization || organization.id !== convexOrg.clerkOrgId) {
    return <div>Loading...</div>;
  }

  return <OrganizationSettingsPage />;
}

