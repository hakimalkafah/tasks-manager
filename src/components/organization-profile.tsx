"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function OrganizationProfileComponent() {
  const router = useRouter();

  const handleClose = () => {
    // Navigate back to the project page
    const currentPath = window.location.pathname;
    const projectSlug = currentPath.split('/')[2]; // Extract slug from /project/[slug]/settings
    if (projectSlug) {
      router.push(`/project/${projectSlug}`);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Project Settings</h2>
        <Button variant="outline" size="sm" onClick={handleClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </div>
      <OrganizationProfile
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-lg border border-gray-200 rounded-lg",
          },
        }}
        routing="hash"
      />
    </div>
  );
}
