import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mocks
const mockUseUser = vi.fn();
const mockUseConvexAuth = vi.fn();
const mockUseQuery = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useOrganization: () => ({ organization: null, isLoaded: true }),
  SignedIn: ({ children }: any) => <>{children}</>,
  SignedOut: ({ children }: any) => null,
  SignInButton: ({ children }: any) => <>{children}</>,
  SignUpButton: ({ children }: any) => <>{children}</>,
  UserButton: () => <div />,
}));

vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useConvexAuth: () => mockUseConvexAuth(),
    useQuery: (q: any, args: any) => mockUseQuery(q, args),
  };
});

// Silence profile sync fetch
(global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

describe('Home auth gating of getUserOrganizations', () => {
  it('does not call getUserOrganizations until isAuthenticated', async () => {
    mockUseUser.mockReturnValue({ user: { id: 'user_member', firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'm@test.com' }] }, isLoaded: true });

    // Start unauthenticated; ensure useQuery gets skip
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    mockUseQuery.mockReturnValueOnce(undefined);

    const { default: Home } = await import('@/app/page');
    const { rerender } = render(<Home />);

    // First render: should pass "skip" to user orgs query
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), 'skip');
    expect(await screen.findByText(/Loading Projects/i)).toBeInTheDocument();

    // Now flip to authenticated and provide data
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockImplementation((q, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'userId' in args) {
        return [
          { _id: 'org1', name: 'Acme', slug: 'acme', imageUrl: '', role: 'admin', joinedAt: Date.now() },
        ];
      }
      return undefined;
    });

    rerender(<Home />);

    // Should render projects and show role under Acme tile
    expect(await screen.findByText('Your Projects')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Acme/i });
    expect(link).toBeInTheDocument();
  });
});
