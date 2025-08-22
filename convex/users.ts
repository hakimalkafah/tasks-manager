import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Store user profile data in Convex for consistent access
export const createOrUpdateUser = mutation({
  args: {
    clerkUserId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existingUser) {
      return await ctx.db.patch(existingUser._id, {
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        updatedAt: Date.now(),
      });
    } else {
      return await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const getUserByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

export const getMultipleUsersByClerkIds = query({
  args: { clerkUserIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const users = await Promise.all(
      args.clerkUserIds.map(async (clerkUserId) => {
        return await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
          .first();
      })
    );
    return users.filter(Boolean);
  },
});
