import { describe, it, expect, beforeEach } from 'vitest';
import { ConvexTestingHelper } from 'convex/testing';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

describe('Users Convex Functions', () => {
  let t: ConvexTestingHelper<typeof schema>;

  beforeEach(async () => {
    t = new ConvexTestingHelper(schema);
    await t.run(async (ctx) => {
      // Clear all data
      const users = await ctx.db.query('users').collect();
      for (const user of users) await ctx.db.delete(user._id);
    });
  });

  describe('createOrUpdateUser', () => {
    it('should create new user when not exists', async () => {
      const userData = {
        clerkUserId: 'user_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const userId = await t.mutation(api.users.createOrUpdateUser, userData);
      expect(userId).toBeDefined();

      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.firstName).toBe('John');
        expect(user?.lastName).toBe('Doe');
        expect(user?.email).toBe('john@example.com');
        expect(user?.clerkUserId).toBe('user_123');
        expect(user?.createdAt).toBeDefined();
        expect(user?.updatedAt).toBeDefined();
      });
    });

    it('should update existing user when already exists', async () => {
      const clerkUserId = 'user_123';
      let existingUserId: any;

      await t.run(async (ctx) => {
        existingUserId = await ctx.db.insert('users', {
          clerkUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const updatedUserId = await t.mutation(api.users.createOrUpdateUser, {
        clerkUserId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
      });

      expect(updatedUserId).toEqual(existingUserId);

      await t.run(async (ctx) => {
        const user = await ctx.db.get(existingUserId);
        expect(user?.firstName).toBe('Jane');
        expect(user?.lastName).toBe('Smith');
        expect(user?.email).toBe('jane@example.com');
        expect(user?.clerkUserId).toBe(clerkUserId);
      });
    });

    it('should preserve createdAt when updating existing user', async () => {
      const clerkUserId = 'user_123';
      const originalCreatedAt = 1000000;
      let existingUserId: any;

      await t.run(async (ctx) => {
        existingUserId = await ctx.db.insert('users', {
          clerkUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdAt: originalCreatedAt,
          updatedAt: originalCreatedAt,
        });
      });

      await t.mutation(api.users.createOrUpdateUser, {
        clerkUserId,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
      });

      await t.run(async (ctx) => {
        const user = await ctx.db.get(existingUserId);
        expect(user?.createdAt).toBe(originalCreatedAt);
        expect(user?.updatedAt).toBeGreaterThan(originalCreatedAt);
      });
    });
  });

  describe('getUserByClerkId', () => {
    it('should return user when exists', async () => {
      const clerkUserId = 'user_123';

      await t.run(async (ctx) => {
        await ctx.db.insert('users', {
          clerkUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const user = await t.query(api.users.getUserByClerkId, { clerkUserId });
      expect(user).toBeTruthy();
      expect(user?.firstName).toBe('John');
      expect(user?.clerkUserId).toBe(clerkUserId);
    });

    it('should return null when user not exists', async () => {
      const user = await t.query(api.users.getUserByClerkId, { 
        clerkUserId: 'non-existent' 
      });
      expect(user).toBeNull();
    });
  });

  describe('getMultipleUsersByClerkIds', () => {
    it('should return multiple users when they exist', async () => {
      const clerkUserIds = ['user_1', 'user_2', 'user_3'];

      await t.run(async (ctx) => {
        await ctx.db.insert('users', {
          clerkUserId: 'user_1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('users', {
          clerkUserId: 'user_2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('users', {
          clerkUserId: 'user_3',
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const users = await t.query(api.users.getMultipleUsersByClerkIds, { clerkUserIds });
      expect(users).toHaveLength(3);
      
      const userIds = users.map(u => u.clerkUserId);
      expect(userIds).toContain('user_1');
      expect(userIds).toContain('user_2');
      expect(userIds).toContain('user_3');
    });

    it('should return only existing users and filter out non-existent ones', async () => {
      const clerkUserIds = ['user_1', 'non_existent', 'user_2'];

      await t.run(async (ctx) => {
        await ctx.db.insert('users', {
          clerkUserId: 'user_1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('users', {
          clerkUserId: 'user_2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const users = await t.query(api.users.getMultipleUsersByClerkIds, { clerkUserIds });
      expect(users).toHaveLength(2);
      
      const userIds = users.map(u => u.clerkUserId);
      expect(userIds).toContain('user_1');
      expect(userIds).toContain('user_2');
      expect(userIds).not.toContain('non_existent');
    });

    it('should return empty array when no users exist', async () => {
      const clerkUserIds = ['non_existent_1', 'non_existent_2'];

      const users = await t.query(api.users.getMultipleUsersByClerkIds, { clerkUserIds });
      expect(users).toHaveLength(0);
    });

    it('should handle empty input array', async () => {
      const users = await t.query(api.users.getMultipleUsersByClerkIds, { clerkUserIds: [] });
      expect(users).toHaveLength(0);
    });
  });
});
