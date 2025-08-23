import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

type OrganizationMembership = {
  organization: {
    id: string;
  };
  role: string;
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clerkOrgId, userId: targetUserId } = await req.json();
    if (!clerkOrgId || !targetUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the Convex organization first
    const convexOrg = await fetchQuery(api.organizations.getOrganization, { clerkOrgId });
    if (!convexOrg) {
      return NextResponse.json(
        { error: "Organization not found in Convex" },
        { status: 404 }
      );
    }

    // Get the latest role from Clerk (source of truth)
    const response = await fetch(
      `https://api.clerk.com/v1/organization_memberships?user_id=${targetUserId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch organization memberships: ${response.statusText}`);
    }

    const memberships = await response.json();
    const clerkMembership = (memberships.data as OrganizationMembership[]).find(
      (m: OrganizationMembership) => m.organization.id === clerkOrgId
    );

    if (!clerkMembership) {
      return NextResponse.json(
        { error: "User is not a member of this organization" },
        { status: 404 }
      );
    }

    // Convert Clerk role to Convex role (treat owner as admin)
    const role = clerkMembership.role === "org:member" ? "member" : "admin";

    // Update the role in Convex
    const membershipId = await fetchMutation(api.organizations.upsertMembershipRole, {
      organizationId: convexOrg._id,
      userId: targetUserId,
      role,
    });

    return NextResponse.json({
      success: true,
      action: membershipId ? "updated" : "created",
      membershipId,
      role,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("sync-roles error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
