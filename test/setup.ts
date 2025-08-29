import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  };
});

// Mock Clerk hooks/components used in the app
vi.mock('@clerk/nextjs', async () => {
  const actual = await vi.importActual<any>('@clerk/nextjs');
  return {
    ...actual,
    useUser: () => ({ user: null, isLoaded: true }),
    useOrganization: () => ({ organization: null, isLoaded: true }),
    SignedIn: ({ children }: any) => null,
    SignedOut: ({ children }: any) => React.createElement(React.Fragment, null, children),
    // Render children directly to avoid nested button structures in tests
    SignInButton: ({ children }: any) => React.createElement(React.Fragment, null, children),
    SignUpButton: ({ children }: any) => React.createElement(React.Fragment, null, children),
    UserButton: () => React.createElement('div'),
  };
});

// Simplify CreateProjectButton to avoid relying on Clerk's client in tests
vi.mock('@/components/create-project-button', () => {
  return {
    CreateProjectButton: () => React.createElement('button', null, 'Create Project'),
  };
});

// Mock Convex hooks used in the app
vi.mock('convex/react', () => {
  return {
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
  };
});
