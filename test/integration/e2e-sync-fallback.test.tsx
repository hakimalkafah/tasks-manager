import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// This test ensures that even if the direct Convex mutation fails on the client,
// the server-side update-role route's immediate Convex sync keeps roles consistent
// so that the Home page shows the updated role for the promoted user.

describe('E2E sync fallback: server-side Convex sync keeps roles consistent', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('promoting a member to admin updates Home even when updateMemberRole fails', async () => {
    // Shared mock state for Convex data
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

    // Mock Clerk (admin performing the action in OrganizationMembers)
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
      };
    });

    // Mock Convex hooks
    const mockUpdateMemberRole = vi.fn().mockRejectedValue(new Error('Convex mutation failed'));
    vi.doMock('convex/react', () => ({
      useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
      useQuery: (_fn: any, args?: any) => {
        if (args === 'skip') return undefined;
        if (args && typeof args === 'object' && 'clerkOrgId' in args) {
          return { _id: 'conv_org_123', name: 'Test Organization' };
        }
        if (args && typeof args === 'object' && 'organizationId' in args) {
          return members;
        }
        if (args && typeof args === 'object' && 'userId' in args) {
          return userOrganizationsForMember;
        }
        return undefined;
      },
      useMutation: () => mockUpdateMemberRole,
    }));

    // Mock fetch: when update-role is called, emulate server-side Convex sync by updating our shared state
    (global as any).fetch = vi.fn(async (url: string, init?: any) => {
      if (url === '/api/organizations/update-role') {
        const body = JSON.parse(init?.body || '{}');
        const targetUserId = body?.targetUserId;
        const role = body?.role; // org:admin | org:member
        // Emulate server mapping org:* to Convex role and updating Convex state
        const convexRole = role === 'org:member' ? 'member' : 'admin';
        // Update membership list
        members = members.map((m) => (m.userId === targetUserId ? { ...m, role: convexRole } : m));
        // Update Home orgs for the member
        userOrganizationsForMember = [{ ...userOrganizationsForMember[0], role: convexRole }];
        return { ok: true, json: async () => ({ ok: true, synced: true }) } as any;
      }
      return { ok: true, json: async () => ({ ok: true }) } as any;
    });

    // 1) Render OrganizationMembers and promote user_member to admin
    const { OrganizationMembers } = await import('@/components/organization-members');
    const user = userEvent.setup();
    const orgRender = render(<OrganizationMembers />);

    const memberRow = screen.getByText('Test Member').closest('div[class*="flex items-center justify-between"]');
    expect(memberRow).toBeInTheDocument();
    expect(memberRow!).toHaveTextContent('member');

    const makeAdminBtn = within(memberRow as HTMLElement).getByRole('button', { name: 'Make Admin' });
    await user.click(makeAdminBtn);

    // Despite the Convex mutation failing, the server-side sync should have updated our shared state
    // Unmount OrganizationMembers and render Home as the promoted user
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
      };
    });

    const { default: Home } = await import('@/app/page');
    render(<Home />);

    const orgLink = await screen.findByRole('link', { name: /Acme/i });
    expect(within(orgLink).getByText('admin', { selector: 'span' })).toBeInTheDocument();
  });
});
