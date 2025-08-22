import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clerkOrgId, targetUserId, role } = await req.json();
    if (!clerkOrgId || !targetUserId || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!["org:admin", "org:member", "org:owner"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Ensure caller is an org admin/owner in Clerk before changing others
    const client = await clerkClient();
    const callerMemberships = await client.users.getOrganizationMembershipList({ userId });
    const callerInOrg = callerMemberships.data.find((m: any) => m.organization.id === clerkOrgId);
    if (!callerInOrg || !["org:admin", "org:owner"].includes(callerInOrg.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find target membership in org
    const targetMemberships = await client.users.getOrganizationMembershipList({ userId: targetUserId });
    const target = targetMemberships.data.find((m: any) => m.organization.id === clerkOrgId);
    if (!target) {
      return NextResponse.json({ error: "Target user is not a member of this organization" }, { status: 404 });
    }

    await client.organizationMemberships.updateOrganizationMembership(target.id, { role });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("update-role error", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
