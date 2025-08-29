"use client";

import { useOrganization } from "@clerk/nextjs";
import { OrganizationProfileComponent } from "@/components/organization-profile";
import { CreateProjectButton } from "@/components/create-project-button";

export default function OrganizationSettingsPage() {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">No Project Selected</h2>
          <p className="text-gray-600 mb-4">Please select or create a project to continue.</p>
          <CreateProjectButton />
        </div>
      </div>
    );
  }

  // Render only Clerk's OrganizationProfile so its modal overlays cleanly without underlying page UI.
  return <OrganizationProfileComponent />;
}
