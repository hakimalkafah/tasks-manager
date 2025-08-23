import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Shared state to simulate Convex data for member user
let state = {
  userId: 'user_member',
  orgs: [
    { _id: 'org1', name: 'Acme', slug: 'acme', imageUrl: '', role: 'member' as const, joinedAt: Date.now() },
  ],
};

const mockUseUser = vi.fn();
const mockUseConvexAuth = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useOrganization: () => ({ organization: null, isLoaded: true }),
  SignedIn: ({ children }: any) => <>{children}</>,
  SignedOut: ({ children }: any) => null,
  SignInButton: ({ children }: any) => <>{children}</>,
  SignUpButton: ({ children }: any) => <>{children}</>,
  UserButton: () => <div />,
}));

const mockUseQuery = vi.fn();
vi.mock('convex/react', async () => {
  const actual = await vi.importActual<any>('convex/react');
  return {
    ...actual,
    useConvexAuth: () => mockUseConvexAuth(),
    useQuery: (q: any, args: any) => mockUseQuery(q, args),
  };
});

(global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

describe('Home live updates when Convex data changes', () => {
  it('updates role on Home tile without remount when backend state changes', async () => {
    mockUseUser.mockReturnValue({ user: { id: state.userId, firstName: 'Test', lastName: 'Member', emailAddresses: [{ emailAddress: 'm@test.com' }] }, isLoaded: true });
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });

    mockUseQuery.mockImplementation((q, args) => {
      if (args === 'skip') return undefined;
      if (args && typeof args === 'object' && 'userId' in args) {
        // Return current state; simulate Convex delivering updates by changing this state and re-rendering
        return state.orgs;
      }
      return undefined;
    });

    const { default: Home } = await import('@/app/page');
    const utils = render(<Home />);

    const link = await screen.findByRole('link', { name: /Acme/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('member');

    // Simulate backend update to admin (as if another client mutated Convex)
    await act(async () => {
      state = {
        ...state,
        orgs: [{ ...state.orgs[0], role: 'admin' }],
      };
      // Force re-render; in real Convex this happens automatically via live query
      utils.rerender(<Home />);
    });

    const link2 = await screen.findByRole('link', { name: /Acme/i });
    expect(link2).toHaveTextContent('admin');
  });
});
