import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/organizations/update-role/route';

// Define mocks in a hoisted context to avoid initialization order issues
const { mockAuth, fetchMock } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    fetchMock: vi.fn(),
  } as const;
});

// Stub global.fetch with our mock implementation
vi.stubGlobal('fetch', (...args) => fetchMock(...args));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock NextResponse.json to return a plain object we can assert on
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({ data, options }))
  }
}));

describe('Role Update API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  it('should successfully update member role from admin to member', async () => {
    // Mock authenticated user
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });

    // Mock Clerk API responses
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ organization: { id: 'org_123' }, role: 'org:admin' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'membership_456',
              organization: { id: 'org_123' },
              role: 'org:admin',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'membership_456', role: 'org:member' }),
      });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'org:member'
      })
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/organization_memberships/membership_456',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'org:member' }),
      })
    );
    expect(response.data.ok).toBe(true);
  });

  it('should reject unauthorized user', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'org:member'
      })
    });

    const response = await POST(request);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.data).toEqual({ error: "Unauthorized" });
    expect(response.options).toEqual({ status: 401 });
  });

  it('should reject non-admin caller', async () => {
    mockAuth.mockResolvedValue({ userId: 'member_user_123' });
    // Mock caller is only a member, not admin
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ organization: { id: 'org_123' }, role: 'org:member' }],
      }),
    });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'org:member'
      })
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ data: { error: "Forbidden" }, options: { status: 403 } });
  });

  it('should reject invalid role', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'invalid_role' // Invalid role
      })
    });

    const response = await POST(request);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response).toEqual({ data: { error: "Invalid role" }, options: { status: 400 } });
  });

  it('should handle missing required fields', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        // Missing targetUserId and role
      })
    });

    const response = await POST(request);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response).toEqual({ data: { error: "Missing required fields" }, options: { status: 400 } });
  });

  it('should handle target user not in organization', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // Mock caller is admin and target user has no membership
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ organization: { id: 'org_123' }, role: 'org:admin' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'org:member'
      })
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ data: { error: "Target user is not a member of this organization" }, options: { status: 404 } });
  });

  it('should handle Clerk API errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // Mock Clerk API error
    fetchMock.mockRejectedValue(new Error('Clerk API Error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'org:member'
      })
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('update-role error', expect.any(Error));
    expect(response).toEqual({ data: { error: "Clerk API Error" }, options: { status: 500 } });

    consoleSpy.mockRestore();
  });

  it('should successfully promote member to admin', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // Mock Clerk API responses
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ organization: { id: 'org_123' }, role: 'org:admin' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'membership_456',
              organization: { id: 'org_123' },
              role: 'org:member',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'membership_456', role: 'org:admin' }),
      });

    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'target_user_456',
        role: 'org:admin'
      })
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/organization_memberships/membership_456',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'org:admin' }),
      })
    );
    expect(response.data.ok).toBe(true);
  });

  it('triggers Convex sync and returns synced=true; owner maps to admin server-side', async () => {
    // Set a dummy Convex URL to allow client creation
    process.env.NEXT_PUBLIC_CONVEX_URL = 'http://convex.test';
    // No network call needed; header short-circuits Convex sync during tests

    // Auth as admin
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ organization: { id: 'org_123' }, role: 'org:owner' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'membership_456',
              organization: { id: 'org_123' },
              role: 'org:member',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'membership_456', role: 'org:owner' }),
      });

    // owner should map to admin for Convex
    const request = new Request('http://localhost/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-mock-convex': '1' },
      body: JSON.stringify({ clerkOrgId: 'org_123', targetUserId: 'target_user_456', role: 'org:owner' })
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/organization_memberships/membership_456',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(response.data.ok).toBe(true);
    expect(response.data.synced).toBe(true);
  });
});
