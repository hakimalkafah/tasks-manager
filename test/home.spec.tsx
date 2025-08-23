import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Default mocks from setup.ts are applied. For specific cases we override below.

describe('Home page', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders public marketing content when signed out', async () => {
    vi.doMock('@clerk/nextjs', async () => {
      const actual = await vi.importActual<any>('@clerk/nextjs');
      return {
        ...actual,
        useUser: () => ({ user: null, isLoaded: true }),
        useOrganization: () => ({ organization: null, isLoaded: true }),
        SignedIn: ({ children }: any) => null,
        SignedOut: ({ children }: any) => <>{children}</>,
        // Avoid nested <button> in tests
        SignInButton: ({ children }: any) => <>{children}</>,
        SignUpButton: ({ children }: any) => <>{children}</>,
        UserButton: () => <div />,
        // Stub to avoid ClerkProvider requirement
        OrganizationSwitcher: () => <div />,
      };
    });

    const { default: Home } = await import('@/app/page');
    render(<Home />);

    expect(
      screen.getByText('Collaborative Task Management')
    ).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('renders user projects when signed in', async () => {
    vi.doMock('@clerk/nextjs', async () => {
      const actual = await vi.importActual<any>('@clerk/nextjs');
      return {
        ...actual,
        useUser: () => ({ user: { firstName: 'Jane', emailAddresses: [{ emailAddress: 'jane@example.com' }] }, isLoaded: true }),
        useOrganization: () => ({ organization: null, isLoaded: true }),
        SignedIn: ({ children }: any) => <>{children}</>,
        SignedOut: ({ children }: any) => null,
        // Avoid nested <button> in tests
        SignInButton: ({ children }: any) => <>{children}</>,
        SignUpButton: ({ children }: any) => <>{children}</>,
        UserButton: () => <div />,
        // Stub to avoid ClerkProvider requirement
        OrganizationSwitcher: () => <div />,
      };
    });

    vi.doMock('convex/react', async (importOriginal) => {
      const actual = await importOriginal<any>();
      return {
        ...actual,
        useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
        // Decide by args shape instead of function name to keep this robust
        useQuery: (_fn: any, args?: any) => {
          if (args && typeof args === 'object' && 'userId' in args) {
            // getUserOrganizations
            return [
              { _id: '1', name: 'Acme', slug: 'acme', imageUrl: '', role: 'org:member', joinedAt: Date.now() },
            ];
          }
          if (args && typeof args === 'object' && 'clerkOrgId' in args) {
            // getOrganization
            return undefined;
          }
          // when "skip" or unknown
          return undefined;
        },
        useMutation: () => vi.fn(),
      };
    });

    const { default: Home } = await import('@/app/page');
    render(<Home />);

    // The page shows loading state initially, then projects
    expect(screen.getByText('Welcome back, Jane!')).toBeInTheDocument();
    // Check for the specific loading text
    expect(screen.getByText('Loading Projects...')).toBeInTheDocument();
  });
});
