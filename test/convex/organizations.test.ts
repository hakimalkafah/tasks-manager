import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConvexTestingHelper } from 'convex/testing';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Organizations Convex Functions', () => {
  let t: ConvexTestingHelper<typeof schema>;

  beforeEach(async () => {
    t = new ConvexTestingHelper(schema);
    await t.run(async (ctx) => {
      // Clear all data
      const orgs = await ctx.db.query('organizations').collect();
      const memberships = await ctx.db.query('organizationMemberships').collect();
      const users = await ctx.db.query('users').collect();
      
      for (const org of orgs) await ctx.db.delete(org._id);
      for (const membership of memberships) await ctx.db.delete(membership._id);
      for (const user of users) await ctx.db.delete(user._id);
    });
  });

  describe('createOrganization', () => {
    it('should create new organization with admin membership', async () => {
      const userId = 'user123';
      const clerkOrgId = 'org_123';

      const orgId = await t.mutation(api.organizations.createOrganization, {
        clerkOrgId,
        name: 'Test Organization',
        slug: 'test-org',
        imageUrl: 'https://example.com/image.png',
        createdBy: userId,
      });

      expect(orgId).toBeDefined();

      await t.run(async (ctx) => {
        const org = await ctx.db.get(orgId);
        expect(org?.name).toBe('Test Organization');
        expect(org?.slug).toBe('test-org');
        expect(org?.createdBy).toBe(userId);

        // Check admin membership was created
        const membership = await ctx.db
          .query('organizationMemberships')
          .withIndex('by_user_and_organization', (q) =>
            q.eq('userId', userId).eq('organizationId', orgId)
          )
          .first();
        
        expect(membership?.role).toBe('admin');
      });
    });

    it('should return existing organization if already exists', async () => {
      const userId = 'user123';
      const clerkOrgId = 'org_123';

      // Create organization first time
      const orgId1 = await t.mutation(api.organizations.createOrganization, {
        clerkOrgId,
        name: 'Test Organization',
        slug: 'test-org',
        createdBy: userId,
      });

      // Try to create same organization again
      const orgId2 = await t.mutation(api.organizations.createOrganization, {
        clerkOrgId,
        name: 'Test Organization Updated',
        slug: 'test-org-updated',
        createdBy: userId,
      });

      expect(orgId1).toEqual(orgId2);
    });

    it('should add user as member if organization exists and user not member', async () => {
      const creatorId = 'creator123';
      const newUserId = 'user456';
      const clerkOrgId = 'org_123';

      // Create organization with creator
      await t.mutation(api.organizations.createOrganization, {
        clerkOrgId,
        name: 'Test Organization',
        slug: 'test-org',
        createdBy: creatorId,
      });

      // Add new user to existing organization
      const orgId = await t.mutation(api.organizations.createOrganization, {
        clerkOrgId,
        name: 'Test Organization',
        slug: 'test-org',
        createdBy: newUserId,
      });

      await t.run(async (ctx) => {
        // Check new user has member role (not admin)
        const membership = await ctx.db
          .query('organizationMemberships')
          .withIndex('by_user_and_organization', (q) =>
            q.eq('userId', newUserId).eq('organizationId', orgId)
          )
          .first();
        
        expect(membership?.role).toBe('member');
      });
    });
  });

  describe('getOrganization', () => {
    it('should return organization by clerkOrgId', async () => {
      const clerkOrgId = 'org_123';
      
      await t.run(async (ctx) => {
        await ctx.db.insert('organizations', {
          clerkOrgId,
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'user123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const org = await t.query(api.organizations.getOrganization, { clerkOrgId });
      expect(org?.name).toBe('Test Org');
      expect(org?.clerkOrgId).toBe(clerkOrgId);
    });

    it('should return null if organization not found', async () => {
      const org = await t.query(api.organizations.getOrganization, { 
        clerkOrgId: 'non-existent' 
      });
      expect(org).toBeNull();
    });
  });

  describe('getOrganizationBySlug', () => {
    it('should return organization by slug', async () => {
      const slug = 'test-org';
      
      await t.run(async (ctx) => {
        await ctx.db.insert('organizations', {
          clerkOrgId: 'org_123',
          name: 'Test Org',
          slug,
          createdBy: 'user123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const org = await t.query(api.organizations.getOrganizationBySlug, { slug });
      expect(org?.name).toBe('Test Org');
      expect(org?.slug).toBe(slug);
    });
  });

  describe('getUserOrganizations', () => {
    it('should return user organizations with roles', async () => {
      const userId = 'user123';
      let orgId1: any, orgId2: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        // Create organizations
        orgId1 = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Org 1',
          slug: 'org-1',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        orgId2 = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_2',
          name: 'Org 2',
          slug: 'org-2',
          createdBy: 'other-user',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Create memberships
        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId1,
          userId,
          role: 'admin',
          joinedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId2,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      const orgs = await t.query(api.organizations.getUserOrganizations, { userId });
      expect(orgs).toHaveLength(2);
      
      const org1 = orgs.find(o => o.name === 'Org 1');
      const org2 = orgs.find(o => o.name === 'Org 2');
      
      expect(org1?.role).toBe('admin');
      expect(org2?.role).toBe('member');
    });

    it('should throw error when user tries to access other user organizations', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: otherUserId });
      });

      await expect(t.query(api.organizations.getUserOrganizations, { userId }))
        .rejects.toThrow('Forbidden');
    });

    it('should include creator organizations even without membership record', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Created Org',
          slug: 'created-org',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        // Note: No membership record created
      });

      const orgs = await t.query(api.organizations.getUserOrganizations, { userId });
      expect(orgs).toHaveLength(1);
      expect(orgs[0].role).toBe('admin');
      expect(orgs[0].name).toBe('Created Org');
    });
  });

  describe('getOrganizationMembers', () => {
    it('should return members with user data from Convex users table', async () => {
      const userId1 = 'user123';
      const userId2 = 'user456';
      let orgId: any;

      await t.run(async (ctx) => {
        // Create organization
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: userId1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Create users in Convex users table
        await ctx.db.insert('users', {
          clerkUserId: userId1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('users', {
          clerkUserId: userId2,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Create memberships
        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId: userId1,
          role: 'admin',
          joinedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId: userId2,
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      const members = await t.query(api.organizations.getOrganizationMembers, { organizationId: orgId });
      expect(members).toHaveLength(2);

      const admin = members.find(m => m.role === 'admin');
      const member = members.find(m => m.role === 'member');

      expect(admin?.user.firstName).toBe('John');
      expect(admin?.user.lastName).toBe('Doe');
      expect(member?.user.firstName).toBe('Jane');
      expect(member?.user.lastName).toBe('Smith');
    });

    it('should return fallback user data when not in Convex users table', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({
          subject: userId,
          givenName: 'Test',
          familyName: 'User',
          email: 'test@example.com',
        });

        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'admin',
          joinedAt: Date.now(),
        });
      });

      const members = await t.query(api.organizations.getOrganizationMembers, { organizationId: orgId });
      expect(members).toHaveLength(1);
      expect(members[0].user.firstName).toBe('Test');
      expect(members[0].user.lastName).toBe('User');
    });
  });

  describe('addOrganizationMember', () => {
    it('should add new member successfully', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const membershipId = await t.mutation(api.organizations.addOrganizationMember, {
        organizationId: orgId,
        userId,
        role: 'member',
      });

      expect(membershipId).toBeDefined();

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.userId).toBe(userId);
        expect(membership?.role).toBe('member');
      });
    });

    it('should throw error when user already member', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.organizations.addOrganizationMember, {
        organizationId: orgId,
        userId,
        role: 'admin',
      })).rejects.toThrow('User is already a member of this organization');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      const userId = 'user123';
      let orgId: any;
      let membershipId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        membershipId = await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      await t.mutation(api.organizations.updateMemberRole, {
        membershipId,
        role: 'admin',
      });

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.role).toBe('admin');
      });
    });
  });

  describe('removeOrganizationMember', () => {
    it('should remove member successfully', async () => {
      const userId = 'user123';
      let orgId: any;
      let membershipId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        membershipId = await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      await t.mutation(api.organizations.removeOrganizationMember, { membershipId });

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership).toBeNull();
      });
    });
  });

  describe('upsertMembershipRole', () => {
    it('should create new membership when not exists', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const membershipId = await t.mutation(api.organizations.upsertMembershipRole, {
        organizationId: orgId,
        userId,
        role: 'admin',
      });

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.role).toBe('admin');
        expect(membership?.userId).toBe(userId);
      });
    });

    it('should update existing membership role', async () => {
      const userId = 'user123';
      let orgId: any;
      let existingMembershipId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        existingMembershipId = await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      const result = await t.mutation(api.organizations.upsertMembershipRole, {
        organizationId: orgId,
        userId,
        role: 'admin',
      });

      expect(result).toEqual(existingMembershipId);

      await t.run(async (ctx) => {
        const membership = await ctx.db.get(existingMembershipId);
        expect(membership?.role).toBe('admin');
      });
    });
  });

  describe('updateOrganization', () => {
    it('should update organization successfully', async () => {
      let orgId: any;

      await t.run(async (ctx) => {
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org_1',
          name: 'Original Name',
          slug: 'original-slug',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.organizations.updateOrganization, {
        id: orgId,
        name: 'Updated Name',
        slug: 'updated-slug',
        imageUrl: 'https://example.com/new-image.png',
      });

      await t.run(async (ctx) => {
        const org = await ctx.db.get(orgId);
        expect(org?.name).toBe('Updated Name');
        expect(org?.slug).toBe('updated-slug');
        expect(org?.imageUrl).toBe('https://example.com/new-image.png');
      });
    });
  });

  describe('cleanupDuplicateOrganizations', () => {
    it('should remove duplicate organizations and keep oldest', async () => {
      const clerkOrgId = 'org_duplicate';
      let orgId1: any, orgId2: any, orgId3: any;

      await t.run(async (ctx) => {
        // Create duplicates with different creation times
        orgId1 = await ctx.db.insert('organizations', {
          clerkOrgId,
          name: 'Org 1',
          slug: 'org-1',
          createdBy: 'user1',
          createdAt: 1000,
          updatedAt: 1000,
        });

        orgId2 = await ctx.db.insert('organizations', {
          clerkOrgId,
          name: 'Org 2',
          slug: 'org-2',
          createdBy: 'user2',
          createdAt: 2000,
          updatedAt: 2000,
        });

        orgId3 = await ctx.db.insert('organizations', {
          clerkOrgId,
          name: 'Org 3',
          slug: 'org-3',
          createdBy: 'user3',
          createdAt: 3000,
          updatedAt: 3000,
        });

        // Create memberships for duplicates
        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId2,
          userId: 'user2',
          role: 'admin',
          joinedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId3,
          userId: 'user3',
          role: 'admin',
          joinedAt: Date.now(),
        });
      });

      const result = await t.mutation(api.organizations.cleanupDuplicateOrganizations, { clerkOrgId });

      expect(result.message).toContain('Cleaned up 2 duplicate organizations');
      expect(result.keptOrganization).toEqual(orgId1);

      await t.run(async (ctx) => {
        // Check only the oldest org remains
        const remainingOrg = await ctx.db.get(orgId1);
        expect(remainingOrg).toBeTruthy();
        expect(remainingOrg?.name).toBe('Org 1');

        // Check duplicates are deleted
        const deletedOrg2 = await ctx.db.get(orgId2);
        const deletedOrg3 = await ctx.db.get(orgId3);
        expect(deletedOrg2).toBeNull();
        expect(deletedOrg3).toBeNull();

        // Check memberships are also deleted
        const memberships = await ctx.db.query('organizationMemberships').collect();
        expect(memberships).toHaveLength(0);
      });
    });

    it('should return no duplicates message when no duplicates exist', async () => {
      const result = await t.mutation(api.organizations.cleanupDuplicateOrganizations, { 
        clerkOrgId: 'non-existent' 
      });

      expect(result.message).toBe('No duplicates found');
    });
  });
});
