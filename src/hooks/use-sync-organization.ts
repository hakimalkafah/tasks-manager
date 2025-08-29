"use client";

import { useOrganization, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

export function useSyncOrganization() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const createOrganization = useMutation(api.organizations.createOrganization);

  useEffect(() => {
    async function syncOrganization() {
      if (organization && user) {
        const slug =
          organization.slug ||
          organization.name.toLowerCase().replace(/\s+/g, "-");
        try {
          await createOrganization({
            clerkOrgId: organization.id,
            name: organization.name,
            slug,
            imageUrl: organization.imageUrl || undefined,
            createdBy: user.id,
          });
        } catch (error) {
          // Swallow sync errors to avoid noisy UI; consider adding toast in the future
        }
      }
    }

    if (organization && user) {
      syncOrganization();
    }
  }, [organization, user, createOrganization]);
}

