import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrgUserColors = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Require membership or org creator
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", args.organizationId)
      )
      .first();
    if (!membership) {
      const org = await ctx.db.get(args.organizationId);
      if (!org || org.createdBy !== identity.subject) throw new Error("Forbidden");
    }

    const rows = await ctx.db
      .query("userColors")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Return compact array
    return rows.map((r) => ({ userId: r.userId, color: r.color }));
  },
});

export const upsertUserColor = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    color: v.string(), // Hex color
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Require membership; allow admins to set any, members only for themselves
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", args.organizationId)
      )
      .first();
    if (!membership) throw new Error("Forbidden");

    if (membership.role !== "admin" && identity.subject !== args.userId) {
      throw new Error("Only admins can set colors for other users");
    }

    const existing = await ctx.db
      .query("userColors")
      .withIndex("by_org_user", (q) => q.eq("organizationId", args.organizationId).eq("userId", args.userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { color: args.color, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("userColors", {
      organizationId: args.organizationId,
      userId: args.userId,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });
  },
});
