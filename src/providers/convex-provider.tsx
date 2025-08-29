"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";
import { useSyncOrganization } from "@/hooks/use-sync-organization";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function SyncOrg({ children }: { children: ReactNode }) {
  useSyncOrganization();
  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <SyncOrg>{children}</SyncOrg>
    </ConvexProviderWithClerk>
  );
}
