import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getTasks = query({
  args: { 
    userId: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Only the user themselves can fetch their tasks. If org specified, must be a member
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
    }
    return await ctx.db
      .query("tasks")
      .withIndex("by_user_and_organization", (q) => 
        q.eq("userId", args.userId).eq("organizationId", args.organizationId)
      )
      .order("desc")
      .collect();
  },
});

export const getOrganizationTasks = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    // Must be signed in and member of organization
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

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

    return await ctx.db
      .query("tasks")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();
  },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    dueDate: v.optional(v.number()),
    userId: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) throw new Error("Unauthorized");

    // If task is for an organization, require membership; members can only create for themselves
    if (args.organizationId) {
      const orgId = args.organizationId;
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", identity.subject).eq("organizationId", orgId)
        )
        .first();
      if (!membership) throw new Error("Forbidden");
      // For parity with events, admins can create tasks for anyone; members only for themselves (already ensured by identity)
    }
    const now = Date.now();
    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      completed: false,
      priority: args.priority,
      dueDate: args.dueDate,
      userId: args.userId,
      organizationId: args.organizationId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found");

    if (existing.organizationId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", identity.subject).eq("organizationId", existing.organizationId!)
        )
        .first();
      if (!membership) throw new Error("Forbidden");
      const isOwner = existing.userId === identity.subject;
      if (membership.role !== "admin" && !isOwner) throw new Error("Forbidden");
    } else {
      // Personal task: only owner can update
      if (existing.userId !== identity.subject) throw new Error("Forbidden");
    }

    const { id, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found");

    if (existing.organizationId) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user_and_organization", (q) =>
          q.eq("userId", identity.subject).eq("organizationId", existing.organizationId!)
        )
        .first();
      if (!membership) throw new Error("Forbidden");
      const isOwner = existing.userId === identity.subject;
      if (membership.role !== "admin" && !isOwner) throw new Error("Forbidden");
    } else {
      if (existing.userId !== identity.subject) throw new Error("Forbidden");
    }

    return await ctx.db.delete(args.id);
  },
});
