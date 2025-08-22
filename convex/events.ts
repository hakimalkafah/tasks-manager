import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrganizationEvents = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    // Require authenticated user and membership in org
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", args.organizationId)
      )
      .first();
    if (!membership) {
      // Allow org creator as implicit admin if membership record is missing
      const org = await ctx.db.get(args.organizationId);
      if (!org || org.createdBy !== identity.subject) throw new Error("Forbidden");
    }

    return await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("asc")
      .collect();
  },
});

export const getUserEvents = query({
  args: { 
    userId: v.string(),
    organizationId: v.optional(v.id("organizations"))
  },
  handler: async (ctx, args) => {
    // Only the user themselves can query their events; if organizationId provided, must be member
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) throw new Error("Forbidden");

    if (args.organizationId) {
      const orgId = args.organizationId;
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", args.userId).eq("organizationId", orgId)
        )
        .first();
      if (!membership) {
        const org = await ctx.db.get(orgId);
        if (!org || org.createdBy !== identity.subject) throw new Error("Forbidden");
      }
      // Get events for user in specific organization
      return await ctx.db
        .query("events")
        .withIndex("by_assigned_to", (q) => q.eq("assignedTo", args.userId))
        .filter((q) => q.eq(q.field("organizationId"), orgId))
        .order("asc")
        .collect();
    } else {
      // Get all events for user across organizations
      return await ctx.db
        .query("events")
        .withIndex("by_assigned_to", (q) => q.eq("assignedTo", args.userId))
        .order("asc")
        .collect();
    }
  },
});

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    assignedTo: v.string(),
    createdBy: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Auth: creator must be signed in and a member of the org
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.createdBy) throw new Error("Unauthorized");

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", args.organizationId)
      )
      .first();
    if (!membership) throw new Error("Forbidden");

    // Members can only create events for themselves
    if (membership.role !== "admin" && args.assignedTo !== identity.subject) {
      throw new Error("Members can only create events assigned to themselves");
    }

    const now = Date.now();
    return await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      startTime: args.startTime,
      endTime: args.endTime,
      assignedTo: args.assignedTo,
      createdBy: args.createdBy,
      organizationId: args.organizationId,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    assignedTo: v.optional(v.string()),
    status: v.optional(v.union(v.literal("scheduled"), v.literal("in_progress"), v.literal("completed"), v.literal("cancelled"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found");

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", existing.organizationId)
      )
      .first();
    if (!membership) throw new Error("Forbidden");

    // Only admins or owners/assignees can update
    const isOwnerOrAssignee = existing.createdBy === identity.subject || existing.assignedTo === identity.subject;
    if (membership.role !== "admin" && !isOwnerOrAssignee) throw new Error("Forbidden");

    // Members cannot reassign to others
    if (membership.role !== "admin" && args.assignedTo && args.assignedTo !== identity.subject) {
      throw new Error("Members cannot reassign events to others");
    }

    const { id, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found");

    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", identity.subject).eq("organizationId", existing.organizationId)
      )
      .first();
    if (!membership) throw new Error("Forbidden");

    const isOwnerOrAssignee = existing.createdBy === identity.subject || existing.assignedTo === identity.subject;
    if (membership.role !== "admin" && !isOwnerOrAssignee) throw new Error("Forbidden");

    return await ctx.db.delete(args.id);
  },
});
