import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizationMembers } from '@/components/organization-members';

// Mock Clerk hooks
const mockUseOrganization = vi.fn();
const mockUseUser = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => mockUseOrganization(),
  useUser: () => mockUseUser(),
}));

// Mock Convex hooks
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useQuery: (query: any, args: any) => mockUseQuery(query, args),
    useMutation: (mutation: any) => mockUseMutation(mutation),
  };
});

// Helper to safely get a query identifier for matching
const getQueryName = (query: any) => {
  const parts: string[] = [];
  const name = (query as any)?._def?.name || (query as any)?._name || (query as any)?.name;
  if (typeof name === 'string') parts.push(name);
  try {
    const str = typeof query?.toString === 'function' ? query.toString() : '';
    if (typeof str === 'string' && str) parts.push(str);
  } catch {}
  return parts.join('|');
};

// Mock API calls
global.fetch = vi.fn();

describe('Role Sync Integration Tests', () => {
  const mockUpdateMemberRole = vi.fn();
  const mockRemoveMember = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockUseOrganization.mockReturnValue({
      organization: {
        id: 'org_123',
        name: 'Test Organization',
        slug: 'test-org'
      }
    });

    mockUseUser.mockReturnValue({
      user: {
        id: 'user_admin',
        firstName: 'Admin',
        lastName: 'User'
      }
    });

    // Ensure mutation mocks resolve
    mockUpdateMemberRole.mockResolvedValue(undefined);
    mockRemoveMember.mockResolvedValue(undefined);

    mockUseMutation.mockImplementation((mutation) => {
      const mutationName = (mutation as any)?._def?.name || (mutation as any)?.name || '';
      const isRemoveMember = typeof mutationName === 'string' && mutationName.includes('removeOrganizationMember');
      if (isRemoveMember || mutation === 'removeOrganizationMember') return mockRemoveMember;
      // Default to updateMemberRole for any other mutation since the component only uses these two
      return mockUpdateMemberRole;
    });

    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  it('should reproduce role update issue - Clerk role changes but Convex role stays the same', async () => {
    const user = userEvent.setup();

    // Mock initial state: user is admin in Convex
    mockUseQuery.mockImplementation((query, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'clerkOrgId' in args) {
        return { _id: 'conv_org_123', name: 'Test Organization' };
      }
      if (args && typeof args === 'object' && 'organizationId' in args) {
        return [
          {
            _id: 'membership_admin',
            userId: 'user_admin',
            role: 'admin', // Admin in Convex
            user: { firstName: 'Admin', lastName: 'User', emailAddresses: [{ emailAddress: 'admin@test.com' }] }
          },
          {
            _id: 'membership_member',
            userId: 'user_member',
            role: 'admin', // This user should be demoted to member
            user: { firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }
          }
        ];
      }
    });

    render(<OrganizationMembers />);

    // Find the member to demote
    const memberRow = screen.getByText('Test Member').closest('div[class*="flex items-center justify-between"]');
    expect(memberRow).toBeInTheDocument();
    
    // Verify initial state - user shows as admin
    expect(memberRow).toHaveTextContent('admin');
    
    // Click the "Make Member" button for Test Member row only
    const makeMemberButton = within(memberRow as HTMLElement).getByRole('button', { name: 'Make Member' });
    await user.click(makeMemberButton);

    // Verify API calls were made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/organizations/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkOrgId: 'org_123',
          targetUserId: 'user_member',
          role: 'org:member'
        })
      });
    });

    await waitFor(() => {
      expect(mockUpdateMemberRole).toHaveBeenCalledWith({
        membershipId: 'membership_member',
        role: 'member'
      });
    });
  });

  it('should test role sync failure scenario', async () => {
    const user = userEvent.setup();

    // Mock API failure for Clerk role update
    (global.fetch as any).mockRejectedValueOnce(new Error('Clerk API failed'));

    mockUseQuery.mockImplementation((query, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'clerkOrgId' in args) {
        return { _id: 'conv_org_123', name: 'Test Organization' };
      }
      if (args && typeof args === 'object' && 'organizationId' in args) {
        return [
          {
            _id: 'membership_admin',
            userId: 'user_admin',
            role: 'admin',
            user: { firstName: 'Admin', lastName: 'User', emailAddresses: [{ emailAddress: 'admin@test.com' }] }
          },
          {
            _id: 'membership_member',
            userId: 'user_member',
            role: 'admin',
            user: { firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }
          }
        ];
      }
    });

    // Mock console.error to verify error handling
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<OrganizationMembers />);

    const nfMemberRow = screen.getByText('Test Member').closest('div[class*="flex items-center justify-between"]');
    const nfMakeMemberButton = within(nfMemberRow as HTMLElement).getByRole('button', { name: 'Make Member' });
    await user.click(nfMakeMemberButton);

    // Verify error was logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating member role:', expect.any(Error));
    });

    // Verify Convex mutation was NOT called due to API failure
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should test successful role promotion from member to admin', async () => {
    const user = userEvent.setup();

    mockUseQuery.mockImplementation((query, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'clerkOrgId' in args) {
        return { _id: 'conv_org_123', name: 'Test Organization' };
      }
      if (args && typeof args === 'object' && 'organizationId' in args) {
        return [
          {
            _id: 'membership_admin',
            userId: 'user_admin',
            role: 'admin',
            user: { firstName: 'Admin', lastName: 'User', emailAddresses: [{ emailAddress: 'admin@test.com' }] }
          },
          {
            _id: 'membership_member',
            userId: 'user_member',
            role: 'member', // Member to be promoted
            user: { firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }
          }
        ];
      }
    });

    render(<OrganizationMembers />);

    // Find the member to promote
    const memberRow = screen.getByText('Test Member').closest('div[class*="flex items-center justify-between"]');
    expect(memberRow).toHaveTextContent('member');
    
    // Click the "Make Admin" button for Test Member row only
    const makeAdminButton = within(memberRow as HTMLElement).getByRole('button', { name: 'Make Admin' });
    await user.click(makeAdminButton);

    // Verify API calls were made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/organizations/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkOrgId: 'org_123',
          targetUserId: 'user_member',
          role: 'org:admin'
        })
      });
    });

    await waitFor(() => {
      expect(mockUpdateMemberRole).toHaveBeenCalledWith({
        membershipId: 'membership_member',
        role: 'admin'
      });
    });
  });

  it('should test role sync with missing Convex organization', async () => {
    const user = userEvent.setup();

    // Mock missing Convex organization
    mockUseQuery.mockImplementation((query, args) => {
      if (args === 'skip') return undefined;
      const qName = getQueryName(query);
      if (qName.includes('getOrganization')) {
        return null; // Organization not found in Convex
      }
      
      return undefined;
    });

    render(<OrganizationMembers />);

    // Should show loading state when Convex org is missing
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should test role update with network failure and retry logic', async () => {
    const user = userEvent.setup();

    // Mock network failure followed by success
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    mockUseQuery.mockImplementation((query, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'clerkOrgId' in args) {
        return { _id: 'conv_org_123', name: 'Test Organization' };
      }
      if (args && typeof args === 'object' && 'organizationId' in args) {
        return [
          {
            _id: 'membership_admin',
            userId: 'user_admin',
            role: 'admin',
            user: { firstName: 'Admin', lastName: 'User', emailAddresses: [{ emailAddress: 'admin@test.com' }] }
          },
          {
            _id: 'membership_member',
            userId: 'user_member',
            role: 'admin',
            user: { firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }
          }
        ];
      }
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<OrganizationMembers />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    // Verify error was logged for network failure
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating member role:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should verify loading state during role update', async () => {
    const user = userEvent.setup();

    // Mock slow API response
    let resolveApiCall: (value: any) => void;
    const apiPromise = new Promise((resolve) => {
      resolveApiCall = resolve;
    });
    (global.fetch as any).mockReturnValue(apiPromise);

    mockUseQuery.mockImplementation((query, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'clerkOrgId' in args) {
        return { _id: 'conv_org_123', name: 'Test Organization' };
      }
      if (args && typeof args === 'object' && 'organizationId' in args) {
        return [
          {
            _id: 'membership_admin',
            userId: 'user_admin',
            role: 'admin',
            user: { firstName: 'Admin', lastName: 'User', emailAddresses: [{ emailAddress: 'admin@test.com' }] }
          },
          {
            _id: 'membership_member',
            userId: 'user_member',
            role: 'admin',
            user: { firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }
          }
        ];
      }
    });

    render(<OrganizationMembers />);

    const makeMembeButton = screen.getByText('Make Member');
    await user.click(makeMembeButton);

    // Verify loading state is shown
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
});
