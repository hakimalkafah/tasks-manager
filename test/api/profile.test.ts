import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as SyncPOST } from '../../src/app/api/profile/sync-to-convex/route';
import { POST as UpdateNamePOST } from '../../src/app/api/profile/update-name/route';
import { NextRequest } from 'next/server';

// Hoisted mocks to avoid initialization order issues
const { mockAuth, mockCurrentUser, mockMutation } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
  mockMutation: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));

vi.mock('convex/nextjs', () => ({
  ConvexHttpClient: vi.fn(() => ({
    mutation: mockMutation,
  })),
}));

describe('Profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'user123' });
  });

  describe('POST /api/profile/sync-to-convex', () => {
    it('should sync user profile to Convex successfully', async () => {
      mockCurrentUser.mockResolvedValue({
        id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
      });
      mockMutation.mockResolvedValue('convex_user_id');

      const request = new NextRequest('http://localhost:3000/api/profile/sync-to-convex', {
        method: 'POST',
      });

      const response = await SyncPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockMutation).toHaveBeenCalledWith(
        expect.any(Object),
        {
          clerkUserId: 'user123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        }
      );
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/profile/sync-to-convex', {
        method: 'POST',
      });

      const response = await SyncPOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found in Clerk', async () => {
      mockCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/profile/sync-to-convex', {
        method: 'POST',
      });

      const response = await SyncPOST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should handle missing email address', async () => {
      mockCurrentUser.mockResolvedValue({
        id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [],
      });

      const request = new NextRequest('http://localhost:3000/api/profile/sync-to-convex', {
        method: 'POST',
      });

      const response = await SyncPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email address required');
    });

    it('should handle Convex errors', async () => {
      mockCurrentUser.mockResolvedValue({
        id: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
      });
      mockMutation.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/profile/sync-to-convex', {
        method: 'POST',
      });

      const response = await SyncPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/profile/update-name', () => {
    it('should update user name successfully', async () => {
      mockMutation.mockResolvedValue('updated_user_id');

      const request = new NextRequest('http://localhost:3000/api/profile/update-name', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await UpdateNamePOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockMutation).toHaveBeenCalledWith(
        expect.any(Object),
        {
          clerkUserId: 'user123',
          firstName: 'Jane',
          lastName: 'Smith',
          email: '', // Default when not provided
        }
      );
    });

    it('should return 401 when not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/profile/update-name', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await UpdateNamePOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile/update-name', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          // lastName missing
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await UpdateNamePOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('First name and last name are required');
    });

    it('should handle empty strings as invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile/update-name', {
        method: 'POST',
        body: JSON.stringify({
          firstName: '',
          lastName: 'Smith',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await UpdateNamePOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('First name and last name are required');
    });

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/profile/update-name', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await UpdateNamePOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle Convex errors', async () => {
      mockMutation.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/profile/update-name', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await UpdateNamePOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
