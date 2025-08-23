import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// End-to-end style integration: perform role change in OrganizationMembers, then verify Home reflects updated role

describe('E2E: Role promotion updates Home project tile role', () => {
  beforeEach(() => {
    vi.resetModules();
    // Stub fetch to avoid URL errors from Home's profile sync effect
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any));
  });

  it('promoting a member to admin updates getUserOrganizations and Home shows admin', async () => {
    // Shared mock state to simulate Convex backend
    let convexOrg: any = { _id: 'conv_org_123', name: 'Test Organization', clerkOrgId: 'org_123' };
    let members = [
      {
        _id: 'membership_admin',
        userId: 'user_admin',
        role: 'admin',
        user: { firstName: 'Admin', lastName: 'User', emailAddresses: [{ emailAddress: 'admin@test.com' }] }
      },
      {
        _id: 'membership_member',
        userId: 'user_member',
        role: 'member',
        user: { firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }
      }
    ];
    let userOrganizationsForMember = [
      { _id: 'org1', name: 'Acme', slug: 'acme', imageUrl: '', role: 'member', joinedAt: Date.now() },
    ];

    // 1) Mock Clerk as admin for OrganizationMembers interaction
    vi.doMock('@clerk/nextjs', async () => {
      const actual = await vi.importActual<any>('@clerk/nextjs');
      return {
        ...actual,
        useOrganization: () => ({ organization: { id: 'org_123', name: 'Test Organization', slug: 'test-org' }, isLoaded: true }),
        useUser: () => ({ user: { id: 'user_admin', firstName: 'Admin', lastName: 'User' }, isLoaded: true }),
        SignedIn: ({ children }: any) => <>{children}</>,
        SignedOut: ({ children }: any) => null,
        SignInButton: ({ children }: any) => <>{children}</>,
        SignUpButton: ({ children }: any) => <>{children}</>,
        UserButton: () => <div />,
        OrganizationSwitcher: () => <div />,
      };
    });

    // 2) Mock Convex hooks used by OrganizationMembers and Home
    // useQuery branches by args keys; useMutation updates shared state
    const mockUpdateMemberRole = vi.fn(async ({ membershipId, role }: any) => {
      members = members.map((m) => (m._id === membershipId ? { ...m, role } : m));
      if (membershipId === 'membership_member') {
        userOrganizationsForMember = [{ ...userOrganizationsForMember[0], role }];
      }
      return undefined;
    });

    vi.doMock('convex/react', async (importOriginal) => {
      const actual = await importOriginal<any>();
      return {
        ...actual,
        useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
        useQuery: (_fn: any, args?: any) => {
          if (args === 'skip') return undefined;
          if (args && typeof args === 'object' && 'clerkOrgId' in args) {
            return convexOrg; // getOrganization
          }
          if (args && typeof args === 'object' && 'organizationId' in args) {
            return members; // getOrganizationMembers
          }
          if (args && typeof args === 'object' && 'userId' in args) {
            return userOrganizationsForMember; // getUserOrganizations for Home
          }
          return undefined;
        },
        useMutation: (mutation: any) => {
          // Default to updateMemberRole to avoid brittle name checks; only special-case remove
          const name = (mutation as any)?._def?.name || (mutation as any)?.name || '';
          if (typeof name === 'string' && name.includes('removeOrganizationMember')) {
            return vi.fn();
          }
          return mockUpdateMemberRole;
        },
      };
    });

    // 3) Import and render OrganizationMembers, perform promotion
    const { OrganizationMembers } = await import('@/components/organization-members');
    const user = userEvent.setup();
    const orgRender = render(<OrganizationMembers />);

    const memberRow = screen.getByText('Test Member').closest('div[class*="flex items-center justify-between"]');
    expect(memberRow).toBeInTheDocument();
    // initially shows member
    expect(memberRow!).toHaveTextContent('member');

    const makeAdminBtn = within(memberRow as HTMLElement).getByRole('button', { name: 'Make Admin' });
    await user.click(makeAdminBtn);

    // Ensure mutation called and shared state updated (await async state)
    await waitFor(() => {
      expect(mockUpdateMemberRole).toHaveBeenCalledWith({ membershipId: 'membership_member', role: 'admin' });
    });

    // 4) Now mock Clerk as the promoted user and render Home, which reads getUserOrganizations
    // Unmount OrganizationMembers to avoid duplicate 'admin' text in the DOM
    orgRender.unmount();
    vi.doMock('@clerk/nextjs', async () => {
      const actual = await vi.importActual<any>('@clerk/nextjs');
      return {
        ...actual,
        useUser: () => ({ user: { id: 'user_member', firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'member@test.com' }] }, isLoaded: true }),
        useOrganization: () => ({ organization: null, isLoaded: true }),
        SignedIn: ({ children }: any) => <>{children}</>,
        SignedOut: ({ children }: any) => null,
        SignInButton: ({ children }: any) => <>{children}</>,
        SignUpButton: ({ children }: any) => <>{children}</>,
        UserButton: () => <div />,
        OrganizationSwitcher: () => <div />,
      };
    });

    const { default: Home } = await import('@/app/page');
    const { rerender } = render(<Home />);

    // Should show updated role as admin under tile (based on shared state updated by mutation)
    expect(await screen.findByText('Your Projects')).toBeInTheDocument();
    const orgLink = screen.getByRole('link', { name: /Acme/i });
    expect(within(orgLink).getByText('admin', { selector: 'span' })).toBeInTheDocument();

    // For completeness, change state back to member and verify rerender reflects it
    userOrganizationsForMember = [{ ...userOrganizationsForMember[0], role: 'member' }];
    rerender(<Home />);
    const orgLink2 = screen.getByRole('link', { name: /Acme/i });
    expect(within(orgLink2).getByText('member', { selector: 'span' })).toBeInTheDocument();
  });
});
