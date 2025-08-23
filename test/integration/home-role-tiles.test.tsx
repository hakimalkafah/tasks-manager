import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// We will mock Clerk and Convex hooks to control data returned to Home page

describe('Home project tiles show updated role', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function mockClerkSignedIn() {
    vi.doMock('@clerk/nextjs', async () => {
      const actual = await vi.importActual<any>('@clerk/nextjs');
      return {
        ...actual,
        useUser: () => ({ user: { id: 'user_123', firstName: 'Alex', lastName: 'Doe', emailAddresses: [{ emailAddress: 'alex@example.com' }] }, isLoaded: true }),
        useOrganization: () => ({ organization: null, isLoaded: true }),
        SignedIn: ({ children }: any) => <>{children}</>,
        SignedOut: ({ children }: any) => null,
        SignInButton: ({ children }: any) => <>{children}</>,
        SignUpButton: ({ children }: any) => <>{children}</>,
        UserButton: () => <div />,
        OrganizationSwitcher: () => <div />,
      };
    });
  }

  it('shows member then updates to admin after promotion', async () => {
    mockClerkSignedIn();

    // Mutable organizations list used by useQuery mock
    let orgs = [
      { _id: 'org1', name: 'Acme', slug: 'acme', imageUrl: '', role: 'member', joinedAt: Date.now() },
    ];

    vi.doMock('convex/react', async (importOriginal) => {
      const actual = await importOriginal<any>();
      return {
        ...actual,
        useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
        useQuery: (_fn: any, args?: any) => {
          if (args && typeof args === 'object' && 'userId' in args) {
            // getUserOrganizations
            return orgs;
          }
          if (args && typeof args === 'object' && 'clerkOrgId' in args) {
            // getOrganization (unused)
            return undefined;
          }
          return undefined; // for "skip" or others
        },
        useMutation: () => vi.fn(),
      };
    });

    const { default: Home } = await import('@/app/page');
    const { rerender } = render(<Home />);

    // Initially shows member under tile
    expect(await screen.findByText('Your Projects')).toBeInTheDocument();
    expect(screen.getByText('member', { selector: 'span' })).toBeInTheDocument();

    // Simulate role promotion reflected from backend by changing mocked data
    orgs = [{ ...orgs[0], role: 'admin' }];

    // Rerender to pick up new mocked query value
    rerender(<Home />);

    // Now shows admin
    expect(await screen.findByText('admin', { selector: 'span' })).toBeInTheDocument();
  });

  it('shows correct role string when Convex returns org:member | org:admin', async () => {
    mockClerkSignedIn();

    let orgs = [
      { _id: 'org1', name: 'Acme', slug: 'acme', imageUrl: '', role: 'org:member', joinedAt: Date.now() },
    ];

    vi.doMock('convex/react', async (importOriginal) => {
      const actual = await importOriginal<any>();
      return {
        ...actual,
        useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
        useQuery: (_fn: any, args?: any) => {
          if (args && typeof args === 'object' && 'userId' in args) return orgs;
          return undefined;
        },
        useMutation: () => vi.fn(),
      };
    });

    const { default: Home } = await import('@/app/page');
    const { rerender } = render(<Home />);

    expect(await screen.findByText('Your Projects')).toBeInTheDocument();
    // UI currently renders role verbatim; verify mapping by simulating updated backend value
    expect(screen.getByText('org:member', { selector: 'span' })).toBeInTheDocument();

    orgs = [{ ...orgs[0], role: 'org:admin' }];
    rerender(<Home />);

    expect(await screen.findByText('org:admin', { selector: 'span' })).toBeInTheDocument();
  });
});
