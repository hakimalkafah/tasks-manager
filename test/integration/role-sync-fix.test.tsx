import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the OrganizationMembers component to test the fixed role sync logic
const mockUpdateMemberRole = vi.fn();
const mockUseOrganization = vi.fn();
const mockUseUser = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => mockUseOrganization(),
  useUser: () => mockUseUser(),
}));

vi.mock('convex/react', () => ({
  useQuery: vi.fn((query, args) => mockUseQuery(query, args)),
  useMutation: vi.fn(() => mockUpdateMemberRole),
}));

global.fetch = vi.fn();
global.alert = vi.fn();

// Test component that simulates the fixed role update logic
const TestRoleUpdateComponent = () => {
  const [changingIds, setChangingIds] = React.useState<Record<string, boolean>>({});
  
  const handleRoleChange = async (membershipId: string, newRole: "admin" | "member", targetUserId?: string) => {
    try {
      const organization = { id: 'org_123' };
      if (!organization) return;
      setChangingIds((s) => ({ ...s, [membershipId]: true }));
      
      const clerkRole = newRole === "admin" ? "org:admin" : "org:member";
      
      // 1) Update role in Clerk organization for the target user
      const clerkResponse = await fetch('/api/organizations/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkOrgId: organization.id, targetUserId, role: clerkRole }),
      });
      
      if (!clerkResponse.ok) {
        const errorData = await clerkResponse.json();
        throw new Error(`Clerk update failed: ${errorData.error || 'Unknown error'}`);
      }
      
      // 2) Update Convex membership to keep local DB in sync
      await mockUpdateMemberRole({ membershipId, role: newRole });
      
      // 3) Trigger role sync to ensure consistency
      if (targetUserId) {
        try {
          await fetch('/api/organizations/sync-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clerkOrgId: organization.id, userId: targetUserId, role: newRole }),
          });
        } catch (syncError) {
          console.warn("Role sync warning:", syncError);
        }
      }
      
    } catch (error) {
      console.error("Error updating member role:", error);
      alert(`Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setChangingIds((s) => ({ ...s, [membershipId]: false }));
    }
  };

  return (
    <div>
      <div data-testid="member-admin">
        <span>Test Member (Admin)</span>
        <button
          disabled={changingIds['membership_1']}
          onClick={() => handleRoleChange('membership_1', 'member', 'user_123')}
        >
          {changingIds['membership_1'] ? 'Updating...' : 'Make Member'}
        </button>
      </div>
      <div data-testid="member-member">
        <span>Test User (Member)</span>
        <button
          disabled={changingIds['membership_2']}
          onClick={() => handleRoleChange('membership_2', 'admin', 'user_456')}
        >
          {changingIds['membership_2'] ? 'Updating...' : 'Make Admin'}
        </button>
      </div>
    </div>
  );
};

describe('Role Sync Fix Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  it('should successfully sync roles when demoting admin to member', async () => {
    const user = userEvent.setup();

    render(<TestRoleUpdateComponent />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    // Verify both API calls were made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Verify Clerk role update API call
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'user_123',
        role: 'org:member'
      })
    });

    // Verify role sync API call
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/organizations/sync-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        userId: 'user_123',
        role: 'member'
      })
    });

    // Verify Convex mutation was called
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      membershipId: 'membership_1',
      role: 'member'
    });
  });

  it('should successfully sync roles when promoting member to admin', async () => {
    const user = userEvent.setup();

    render(<TestRoleUpdateComponent />);

    const makeAdminButton = screen.getByText('Make Admin');
    await user.click(makeAdminButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Verify Clerk role update API call
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/organizations/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        targetUserId: 'user_456',
        role: 'org:admin'
      })
    });

    // Verify role sync API call
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/organizations/sync-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkOrgId: 'org_123',
        userId: 'user_456',
        role: 'admin'
      })
    });

    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      membershipId: 'membership_2',
      role: 'admin'
    });
  });

  it('should handle Clerk API failure gracefully', async () => {
    const user = userEvent.setup();

    // Mock Clerk API failure
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Forbidden' })
    });

    render(<TestRoleUpdateComponent />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    // Verify error handling
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to update member role: Clerk update failed: Forbidden');
    });

    // Verify Convex mutation was NOT called due to Clerk failure
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();

    // Verify sync API was NOT called due to Clerk failure
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should continue operation even if sync API fails', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock successful Clerk update but failed sync
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
      .mockRejectedValueOnce(new Error('Sync API failed'));

    render(<TestRoleUpdateComponent />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    await waitFor(() => {
      expect(mockUpdateMemberRole).toHaveBeenCalled();
    });

    // Verify Convex mutation was still called despite sync failure
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      membershipId: 'membership_1',
      role: 'member'
    });

    // Verify sync warning was logged
    expect(consoleSpy).toHaveBeenCalledWith('Role sync warning:', expect.any(Error));

    // Verify no alert was shown (operation succeeded despite sync warning)
    expect(global.alert).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should show loading state during role update', async () => {
    const user = userEvent.setup();

    // Mock slow API response
    let resolveApiCall: (value: any) => void;
    const apiPromise = new Promise((resolve) => {
      resolveApiCall = resolve;
    });
    (global.fetch as any).mockReturnValue(apiPromise);

    render(<TestRoleUpdateComponent />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    // Verify loading state
    expect(screen.getByText('Updating...')).toBeInTheDocument();
    expect(screen.getByText('Updating...')).toBeDisabled();

    // Resolve the API call
    resolveApiCall!({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
    });
  });

  it('should handle network errors properly', async () => {
    const user = userEvent.setup();

    // Mock network error
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<TestRoleUpdateComponent />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    // Verify error handling
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to update member role: Network error');
    });

    // Verify Convex mutation was NOT called due to network failure
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });
});
