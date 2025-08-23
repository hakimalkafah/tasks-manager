import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Sync roles from Clerk to Convex for a specific organization
export const syncOrganizationRoles = mutation({
  args: {
    clerkOrgId: v.string(),
    members: v.array(v.object({
      userId: v.string(),
      role: v.union(v.literal("admin"), v.literal("member")),
    }))
  },
  handler: async (ctx, args) => {
    // Get the Convex organization
    const convexOrg = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    if (!convexOrg) {
      throw new Error("Organization not found in Convex");
    }

    // Get current memberships in Convex
    const currentMemberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organization", (q) => q.eq("organizationId", convexOrg._id))
      .collect();

    // Create a map of current memberships by userId
    const currentMembershipMap = new Map(
      currentMemberships.map(m => [m.userId, m])
    );

    // Update or create memberships based on Clerk data
    for (const member of args.members) {
      const existingMembership = currentMembershipMap.get(member.userId);
      
      if (existingMembership) {
        // Update existing membership if role changed
        if (existingMembership.role !== member.role) {
          await ctx.db.patch(existingMembership._id, {
            role: member.role,
          });
          console.log(`Updated role for user ${member.userId} to ${member.role}`);
        }
        // Remove from map to track processed members
        currentMembershipMap.delete(member.userId);
      } else {
        // Create new membership
        await ctx.db.insert("organizationMemberships", {
          organizationId: convexOrg._id,
          userId: member.userId,
          role: member.role,
          joinedAt: Date.now(),
        });
        console.log(`Added user ${member.userId} with role ${member.role}`);
      }
    }

    // Remove memberships that no longer exist in Clerk
    for (const [userId, membership] of currentMembershipMap) {
      await ctx.db.delete(membership._id);
      console.log(`Removed user ${userId} from organization`);
    }

    return {
      updated: args.members.length,
      removed: currentMembershipMap.size,
      organizationId: convexOrg._id
    };
  },
});

// Get role sync status for an organization
export const getRoleSyncStatus = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const convexOrg = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    if (!convexOrg) {
      return { synced: false, error: "Organization not found in Convex" };
    }

    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organization", (q) => q.eq("organizationId", convexOrg._id))
      .collect();

    return {
      synced: true,
      organizationId: convexOrg._id,
      memberCount: memberships.length,
      lastSyncAt: convexOrg.updatedAt || convexOrg.createdAt
    };
  },
});

// Force sync a single user's role
export const syncUserRole = mutation({
  args: {
    clerkOrgId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const convexOrg = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    if (!convexOrg) {
      throw new Error("Organization not found in Convex");
    }

    // Check if membership exists
    const existingMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) => 
        q.eq("userId", args.userId).eq("organizationId", convexOrg._id)
      )
      .first();

    if (existingMembership) {
      // Update existing membership
      await ctx.db.patch(existingMembership._id, {
        role: args.role,
      });
      return { action: "updated", membershipId: existingMembership._id };
    } else {
      // Create new membership
      const membershipId = await ctx.db.insert("organizationMemberships", {
        organizationId: convexOrg._id,
        userId: args.userId,
        role: args.role,
        joinedAt: Date.now(),
      });
      return { action: "created", membershipId };
    }
  },
});
