import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

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
    const callerMemberships = await fetch(
      `https://api.clerk.com/v1/organization_memberships?user_id=${userId}`,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!callerMemberships.ok) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    const callerData = await callerMemberships.json();
    const callerInOrg = callerData.data.find((m: any) => m.organization.id === clerkOrgId);
    
    if (!callerInOrg || !["org:admin", "org:owner"].includes(callerInOrg.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find target membership in org
    const targetMemberships = await fetch(
      `https://api.clerk.com/v1/organization_memberships?user_id=${targetUserId}`,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!targetMemberships.ok) {
      return NextResponse.json({ error: "Failed to fetch target user memberships" }, { status: 500 });
    }

    const targetData = await targetMemberships.json();
    const target = targetData.data.find((m: any) => m.organization.id === clerkOrgId);
    
    if (!target) {
      return NextResponse.json({ error: "Target user is not a member of this organization" }, { status: 404 });
    }

    // Update role in Clerk (source of truth)
    const updateResponse = await fetch(
      `https://api.clerk.com/v1/organization_memberships/${target.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        body: JSON.stringify({ role })
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      console.error("Failed to update role in Clerk:", error);
      return NextResponse.json({ error: "Failed to update role" }, { status: updateResponse.status });
    }

    // For test environments or when explicitly requested, skip Convex sync
    if (req.headers && req.headers.get('x-test-mock-convex') === '1') {
      return NextResponse.json({ 
        ok: true, 
        synced: true, 
        action: 'mocked', 
        membershipId: target.id 
      });
    }

    // Let the webhook handler take care of syncing to Convex
    // This ensures we don't have race conditions between direct updates and webhooks
    // The webhook will be triggered by the Clerk update we just made
    return NextResponse.json({ 
      ok: true, 
      synced: true, 
      action: 'updated', 
      membershipId: target.id 
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("update-role error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
