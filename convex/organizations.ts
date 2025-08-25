import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createOrganization = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if organization already exists
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    if (existingOrg) {
      // Check if creator is already a member
      const existingMembership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user_and_organization", (q) => 
          q.eq("userId", args.createdBy).eq("organizationId", existingOrg._id)
        )
        .first();

      if (!existingMembership) {
        // Add user as member if not already a member (only original creator should be admin)
        const role = existingOrg.createdBy === args.createdBy ? "admin" : "member";
        await ctx.db.insert("organizationMemberships", {
          organizationId: existingOrg._id,
          userId: args.createdBy,
          role: role,
          joinedAt: now,
        });
      }

      return existingOrg._id;
    }
    
    // Create organization
    const orgId = await ctx.db.insert("organizations", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: args.slug,
      imageUrl: args.imageUrl,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as admin
    await ctx.db.insert("organizationMemberships", {
      organizationId: orgId,
      userId: args.createdBy,
      role: "admin",
      joinedAt: now,
    });

    return orgId;
  },
});

export const getOrganization = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();
  },
});

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getUserOrganizations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Derive userId from identity; if not signed in, return empty to avoid client runtime errors during auth transitions
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    // Get organizations where user has membership
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const membershipOrgs = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        return {
          ...org,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
    );

    // Also get organizations where user is the creator (but may not have membership record)
    const createdOrgs = await ctx.db
      .query("organizations")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    // Combine and deduplicate
    const allOrgs = new Map();
    
    // Add membership-based orgs
    membershipOrgs.filter(Boolean).forEach(org => {
      allOrgs.set(org._id, org);
    });
    
    // Add creator orgs (with admin role if not already present)
    createdOrgs.forEach(org => {
      if (!allOrgs.has(org._id)) {
        allOrgs.set(org._id, {
          ...org,
          role: "admin", // Creator is implicitly admin
          joinedAt: org.createdAt,
        });
      }
    });

    return Array.from(allOrgs.values());
  },
});

// Debug queries for testing
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

export const getAllMemberships = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizationMemberships").collect();
  },
});

export const getByCreatedBy = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
  },
});

export const getOrganizationMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Get user data from Convex users table for proper names
    const membersWithUsers = await Promise.all(
      memberships.map(async (membership) => {
        // Try to get user data from Convex users table
        const userData = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", membership.userId))
          .first();

        if (userData) {
          return {
            _id: membership._id,
            userId: membership.userId,
            role: membership.role,
            joinedAt: membership.joinedAt,
            user: {
              firstName: userData.firstName,
              lastName: userData.lastName,
              emailAddresses: [{ emailAddress: userData.email }],
            },
          };
        } else {
          // Fallback for users not yet in Convex users table
          try {
            const identity = await ctx.auth.getUserIdentity();
            if (identity && membership.userId === identity.subject) {
              return {
                _id: membership._id,
                userId: membership.userId,
                role: membership.role,
                joinedAt: membership.joinedAt,
                user: {
                  firstName: (identity.givenName as string) || "User",
                  lastName: (identity.familyName as string) || membership.userId.slice(-4),
                  emailAddresses: [{ emailAddress: (identity.email as string) || `user-${membership.userId.slice(-4)}@example.com` }],
                },
              };
            } else {
              return {
                _id: membership._id,
                userId: membership.userId,
                role: membership.role,
                joinedAt: membership.joinedAt,
                user: {
                  firstName: "User",
                  lastName: membership.userId.slice(-4),
                  emailAddresses: [{ emailAddress: `user-${membership.userId.slice(-4)}@project.com` }],
                },
              };
            }
          } catch (error) {
            return {
              _id: membership._id,
              userId: membership.userId,
              role: membership.role,
              joinedAt: membership.joinedAt,
              user: {
                firstName: "User",
                lastName: membership.userId.slice(-4),
                emailAddresses: [{ emailAddress: `user-${membership.userId.slice(-4)}@project.com` }],
              },
            };
          }
        }
      })
    );

    return membersWithUsers;
  },
});

export const addOrganizationMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    // Check if user is already a member
    const existingMembership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) => 
        q.eq("userId", args.userId).eq("organizationId", args.organizationId)
      )
      .first();

    if (existingMembership) {
      throw new Error("User is already a member of this organization");
    }

    return await ctx.db.insert("organizationMemberships", {
      organizationId: args.organizationId,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    membershipId: v.id("organizationMemberships"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.membershipId, {
      role: args.role,
    });
  },
});

export const removeOrganizationMember = mutation({
  args: { membershipId: v.id("organizationMemberships") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.membershipId);
  },
});

export const upsertMembershipRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user_and_organization", (q) => q.eq("userId", args.userId).eq("organizationId", args.organizationId))
      .first();

    if (existing) {
      return await ctx.db.patch(existing._id, { role: args.role });
    }

    return await ctx.db.insert("organizationMemberships", {
      organizationId: args.organizationId,
      userId: args.userId,
      role: args.role,
      joinedAt: args.joinedAt ?? Date.now(),
    });
  },
});

export const updateOrganization = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const cleanupDuplicateOrganizations = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    // Find all organizations with the same clerkOrgId
    const duplicates = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .collect();

    if (duplicates.length <= 1) {
      return { message: "No duplicates found" };
    }

    // Keep the first one (oldest), delete the rest
    const [keepOrg, ...deleteOrgs] = duplicates.sort((a, b) => a.createdAt - b.createdAt);

    // Delete duplicate organizations and their memberships
    for (const org of deleteOrgs) {
      // Delete memberships first
      const memberships = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();
      
      for (const membership of memberships) {
        await ctx.db.delete(membership._id);
      }
      
      // Delete the organization
      await ctx.db.delete(org._id);
    }

    return { 
      message: `Cleaned up ${deleteOrgs.length} duplicate organizations`,
      keptOrganization: keepOrg._id 
    };
  },
});

export const getAllOrganizations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});
