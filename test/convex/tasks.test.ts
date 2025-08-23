import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConvexTestingHelper } from 'convex/testing';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Tasks Convex Functions', () => {
  let t: ConvexTestingHelper<typeof schema>;

  beforeEach(async () => {
    t = new ConvexTestingHelper(schema);
    await t.run(async (ctx) => {
      // Clear all data
      const tasks = await ctx.db.query('tasks').collect();
      const orgs = await ctx.db.query('organizations').collect();
      const memberships = await ctx.db.query('organizationMemberships').collect();
      
      for (const task of tasks) await ctx.db.delete(task._id);
      for (const org of orgs) await ctx.db.delete(org._id);
      for (const membership of memberships) await ctx.db.delete(membership._id);
    });
  });

  describe('getTasks', () => {
    it('should return user tasks when authenticated', async () => {
      const userId = 'user123';
      
      await t.run(async (ctx) => {
        // Mock authentication
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        // Create test task
        await ctx.db.insert('tasks', {
          title: 'Test Task',
          description: 'Test Description',
          completed: false,
          priority: 'medium',
          userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.tasks.getTasks, { userId });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Task');
    });

    it('should throw error when user tries to access other user tasks', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      
      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: otherUserId });
      });

      await expect(t.query(api.tasks.getTasks, { userId }))
        .rejects.toThrow('Forbidden');
    });

    it('should return organization tasks when user is member', async () => {
      const userId = 'user123';
      let orgId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        // Create organization
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
          name: 'Test Org',
          slug: 'test-org',
          createdBy: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Create membership
        await ctx.db.insert('organizationMemberships', {
          organizationId: orgId,
          userId,
          role: 'admin',
          joinedAt: Date.now(),
        });

        // Create org task
        await ctx.db.insert('tasks', {
          title: 'Org Task',
          completed: false,
          priority: 'high',
          userId,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.tasks.getTasks, { userId, organizationId: orgId });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Org Task');
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

      await expect(t.query(api.tasks.getTasks, { userId, organizationId: orgId }))
        .rejects.toThrow('Forbidden');
    });
  });

  describe('getOrganizationTasks', () => {
    it('should return all organization tasks for member', async () => {
      const userId = 'user123';
      const userId2 = 'user456';
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

        // Create tasks for different users in same org
        await ctx.db.insert('tasks', {
          title: 'Task 1',
          completed: false,
          priority: 'high',
          userId,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('tasks', {
          title: 'Task 2',
          completed: false,
          priority: 'medium',
          userId: userId2,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.tasks.getOrganizationTasks, { organizationId: orgId });
      expect(result).toHaveLength(2);
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

      await expect(t.query(api.tasks.getOrganizationTasks, { organizationId: orgId }))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('createTask', () => {
    it('should create personal task successfully', async () => {
      const userId = 'user123';
      
      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
      });

      const taskId = await t.mutation(api.tasks.createTask, {
        title: 'New Task',
        description: 'Task description',
        priority: 'high',
        userId,
      });

      expect(taskId).toBeDefined();

      await t.run(async (ctx) => {
        const task = await ctx.db.get(taskId);
        expect(task?.title).toBe('New Task');
        expect(task?.completed).toBe(false);
        expect(task?.priority).toBe('high');
      });
    });

    it('should create organization task when user is member', async () => {
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
          role: 'member',
          joinedAt: Date.now(),
        });
      });

      const taskId = await t.mutation(api.tasks.createTask, {
        title: 'Org Task',
        priority: 'medium',
        userId,
        organizationId: orgId,
      });

      await t.run(async (ctx) => {
        const task = await ctx.db.get(taskId);
        expect(task?.organizationId).toEqual(orgId);
      });
    });

    it('should throw error when user not authenticated', async () => {
      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue(null);
      });

      await expect(t.mutation(api.tasks.createTask, {
        title: 'New Task',
        priority: 'high',
        userId: 'user123',
      })).rejects.toThrow('Unauthorized');
    });

    it('should throw error when creating org task without membership', async () => {
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

      await expect(t.mutation(api.tasks.createTask, {
        title: 'Org Task',
        priority: 'medium',
        userId,
        organizationId: orgId,
      })).rejects.toThrow('Forbidden');
    });
  });

  describe('updateTask', () => {
    it('should update personal task successfully', async () => {
      const userId = 'user123';
      let taskId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        taskId = await ctx.db.insert('tasks', {
          title: 'Original Task',
          completed: false,
          priority: 'low',
          userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.tasks.updateTask, {
        id: taskId,
        title: 'Updated Task',
        completed: true,
        priority: 'high',
      });

      await t.run(async (ctx) => {
        const task = await ctx.db.get(taskId);
        expect(task?.title).toBe('Updated Task');
        expect(task?.completed).toBe(true);
        expect(task?.priority).toBe('high');
      });
    });

    it('should allow admin to update any org task', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let taskId: any;

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

        taskId = await ctx.db.insert('tasks', {
          title: 'Other User Task',
          completed: false,
          priority: 'low',
          userId: otherUserId,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.tasks.updateTask, {
        id: taskId,
        title: 'Updated by Admin',
      });

      await t.run(async (ctx) => {
        const task = await ctx.db.get(taskId);
        expect(task?.title).toBe('Updated by Admin');
      });
    });

    it('should not allow member to update other user tasks', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let taskId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
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

        taskId = await ctx.db.insert('tasks', {
          title: 'Other User Task',
          completed: false,
          priority: 'low',
          userId: otherUserId,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.tasks.updateTask, {
        id: taskId,
        title: 'Should not work',
      })).rejects.toThrow('Forbidden');
    });

    it('should throw error when task not found', async () => {
      const userId = 'user123';

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
      });

      await expect(t.mutation(api.tasks.updateTask, {
        id: 'non-existent-id' as any,
        title: 'Should not work',
      })).rejects.toThrow('Not found');
    });
  });

  describe('deleteTask', () => {
    it('should delete personal task successfully', async () => {
      const userId = 'user123';
      let taskId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        taskId = await ctx.db.insert('tasks', {
          title: 'Task to Delete',
          completed: false,
          priority: 'low',
          userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.tasks.deleteTask, { id: taskId });

      await t.run(async (ctx) => {
        const task = await ctx.db.get(taskId);
        expect(task).toBeNull();
      });
    });

    it('should allow admin to delete any org task', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let taskId: any;

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

        taskId = await ctx.db.insert('tasks', {
          title: 'Task to Delete',
          completed: false,
          priority: 'low',
          userId: otherUserId,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.mutation(api.tasks.deleteTask, { id: taskId });

      await t.run(async (ctx) => {
        const task = await ctx.db.get(taskId);
        expect(task).toBeNull();
      });
    });

    it('should not allow member to delete other user tasks', async () => {
      const userId = 'user123';
      const otherUserId = 'user456';
      let orgId: any;
      let taskId: any;

      await t.run(async (ctx) => {
        ctx.auth.getUserIdentity = vi.fn().mockResolvedValue({ subject: userId });
        
        orgId = await ctx.db.insert('organizations', {
          clerkOrgId: 'org123',
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

        taskId = await ctx.db.insert('tasks', {
          title: 'Task to Delete',
          completed: false,
          priority: 'low',
          userId: otherUserId,
          organizationId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(t.mutation(api.tasks.deleteTask, { id: taskId }))
        .rejects.toThrow('Forbidden');
    });
  });
});
