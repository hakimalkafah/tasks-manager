import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConvexTestingHelper } from 'convex/testing';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Events Convex Functions', () => {
  let t: ConvexTestingHelper<typeof schema>;

  beforeEach(async () => {
    t = new ConvexTestingHelper(schema);
    await t.run(async (ctx) => {
      // Clear all data
      const events = await ctx.db.query('events').collect();
      const orgs = await ctx.db.query('organizations').collect();
      const memberships = await ctx.db.query('organizationMemberships').collect();
      
      for (const event of events) await ctx.db.delete(event._id);
      for (const org of orgs) await ctx.db.delete(org._id);
      for (const membership of memberships) await ctx.db.delete(membership._id);
    });
  });

  describe('getOrganizationEvents', () => {
    it('should return organization events for member', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
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

        await ctx.db.insert('events', {
          title: 'Team Meeting',
          description: 'Weekly sync',
          startTime: Date.now() + 86400000, // Tomorrow
          endTime: Date.now() + 90000000, // Tomorrow + 1 hour
          assignedTo: userId,
          createdBy: userId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const events = await t.query(api.events.getOrganizationEvents, { organizationId: orgId });
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Team Meeting');
    });

    it('should throw error when user not authenticated', async () => {
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(null);
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'user123',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.query(api.events.getOrganizationEvents, { organizationId: orgId }))
        .rejects.toThrow('Unauthorized');
    });

    it('should throw error when user not member of organization', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'otherUser',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.query(api.events.getOrganizationEvents, { organizationId: orgId }))
        .rejects.toThrow('Forbidden');
    });

    it('should allow organization creator even without membership record', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('events', {
          title: 'Creator Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: userId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const events = await t.query(api.events.getOrganizationEvents, { organizationId: orgId });
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Creator Event');
    });
  });

  describe('getUserEvents', () => {
    it('should return user events across all organizations', async () => {
      const userId = 'user123';
      let orgId1: any, orgId2: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId1 = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Org 1',
          slug: 'org-1',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        orgId2 = await ctx.db.insert('organizations', {
          clerkOrgId: 'org2',
          name: 'Org 2',
          slug: 'org-2',
          createdBy: 'otherUser',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Create events in different organizations
        await ctx.db.insert('events', {
          title: 'Event 1',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: userId,
          organizationId: orgId1,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('events', {
          title: 'Event 2',
          startTime: Date.now() + 172800000,
          endTime: Date.now() + 176400000,
          assignedTo: userId,
          createdBy: 'otherUser',
          organizationId: orgId2,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const events = await t.query(api.events.getUserEvents, { userId });
      expect(events).toHaveLength(2);
    });

    it('should return user events for specific organization when member', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Org 1',
          slug: 'org-1',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });

        await ctx.db.insert('events', {
          title: 'Org Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: 'admin',
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const events = await t.query(api.events.getUserEvents, { userId, organizationId: orgId });
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Org Event');
    });

    it('should throw error when user tries to access other user events', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: otherUserId });
      });

      await expect(t.query(api.events.getUserEvents, { userId }))
        .rejects.toThrow('Forbidden');
    });
  });

  describe('createEvent', () => {
    it('should create event when user is admin', async () => {
      const userId = 'user123';
      const assignedUserId = 'user456';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
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

      const eventId = await t.mutation(api.events.createEvent, {
        title: 'New Event',
        description: 'Event description',
        startTime: Date.now() + 86400000,
        endTime: Date.now() + 90000000,
        assignedTo: assignedUserId,
        createdBy: userId,
        organizationId: orgId,
      });

      expect(eventId).toBeDefined();

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        expect(event?.title).toBe('New Event');
        expect(event?.assignedTo).toBe(assignedUserId);
        expect(event?.status).toBe('scheduled');
      });
    });

    it('should allow member to create event for themselves', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

      const eventId = await t.mutation(api.events.createEvent, {
        title: 'Self Event',
        startTime: Date.now() + 86400000,
        endTime: Date.now() + 90000000,
        assignedTo: userId,
        createdBy: userId,
        organizationId: orgId,
      });

      expect(eventId).toBeDefined();
    });

    it('should not allow member to create event for others', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

      await expect(t.mutation(api.events.createEvent, {
        title: 'Other Event',
        startTime: Date.now() + 86400000,
        endTime: Date.now() + 90000000,
        assignedTo: otherUserId,
        createdBy: userId,
        organizationId: orgId,
      })).rejects.toThrow('Members can only create events assigned to themselves');
    });

    it('should throw error when user not authenticated', async () => {
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(null);
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.events.createEvent, {
        title: 'Event',
        startTime: Date.now() + 86400000,
        endTime: Date.now() + 90000000,
        assignedTo: 'user123',
        createdBy: 'user123',
        organizationId: orgId,
      })).rejects.toThrow('Unauthorized');
    });

    it('should throw error when user not member of organization', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.events.createEvent, {
        title: 'Event',
        startTime: Date.now() + 86400000,
        endTime: Date.now() + 90000000,
        assignedTo: userId,
        createdBy: userId,
        organizationId: orgId,
      })).rejects.toThrow('Forbidden');
    });
  });

  describe('updateEvent', () => {
    it('should allow admin to update any event', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'admin',
          joinedAt: Date.now(),
        });

        eventId = await ctx.db.insert('events', {
          title: 'Original Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: otherUserId,
          createdBy: otherUserId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.events.updateEvent, {
        id: eventId,
        title: 'Updated Event',
        status: 'in_progress',
      });

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        expect(event?.title).toBe('Updated Event');
        expect(event?.status).toBe('in_progress');
      });
    });

    it('should allow owner to update their event', async () => {
      const userId = 'user123';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

        eventId = await ctx.db.insert('events', {
          title: 'My Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: userId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.events.updateEvent, {
        id: eventId,
        status: 'completed',
      });

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        expect(event?.status).toBe('completed');
      });
    });

    it('should allow assignee to update their assigned event', async () => {
      const userId = 'user123';
      const creatorId = 'creator456';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'admin',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'member',
          joinedAt: Date.now(),
        });

        eventId = await ctx.db.insert('events', {
          title: 'Assigned Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: creatorId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.events.updateEvent, {
        id: eventId,
        status: 'in_progress',
      });

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        expect(event?.status).toBe('in_progress');
      });
    });

    it('should not allow member to reassign event to others', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

        eventId = await ctx.db.insert('events', {
          title: 'My Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: userId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.events.updateEvent, {
        id: eventId,
        assignedTo: otherUserId,
      })).rejects.toThrow('Members cannot reassign events to others');
    });

    it('should not allow member to update other user events', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

        eventId = await ctx.db.insert('events', {
          title: 'Other Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: otherUserId,
          createdBy: otherUserId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.events.updateEvent, {
        id: eventId,
        status: 'completed',
      })).rejects.toThrow('Forbidden');
    });

    it('should throw error when event not found', async () => {
      const userId = 'user123';

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
      });

      await expect(t.mutation(api.events.updateEvent, {
        id: 'non-existent-id' as any,
        title: 'Should not work',
      })).rejects.toThrow('Not found');
    });
  });

  describe('deleteEvent', () => {
    it('should allow admin to delete any event', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: 'creator',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'admin',
          joinedAt: Date.now(),
        });

        eventId = await ctx.db.insert('events', {
          title: 'Event to Delete',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: otherUserId,
          createdBy: otherUserId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.events.deleteEvent, { id: eventId });

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        expect(event).toBeNull();
      });
    });

    it('should allow owner to delete their event', async () => {
      const userId = 'user123';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

        eventId = await ctx.db.insert('events', {
          title: 'My Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: userId,
          createdBy: userId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.events.deleteEvent, { id: eventId });

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        expect(event).toBeNull();
      });
    });

    it('should not allow member to delete other user events', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let eventId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org1',
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

        eventId = await ctx.db.insert('events', {
          title: 'Other Event',
          startTime: Date.now() + 86400000,
          endTime: Date.now() + 90000000,
          assignedTo: otherUserId,
          createdBy: otherUserId,
          organizationId: orgId,
          status: 'scheduled',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.events.deleteEvent, { id: eventId }))
        .rejects.toThrow('Forbidden');
    });
  });
});
