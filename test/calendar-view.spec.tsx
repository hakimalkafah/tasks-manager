import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock CSS for react-big-calendar to avoid import issues
vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}), { virtual: true });

describe('Calendar threeDay view', () => {
  it('renders timed event in time grid with hour gutter', async () => {
    vi.resetModules();
    const { api } = await import('../convex/_generated/api');

    // Mock matchMedia for mobile view
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Polyfill ResizeObserver used by react-big-calendar
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (global as any).ResizeObserver = ResizeObserver;

    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);

    const timedEvent = {
      _id: '1',
      title: 'Meeting',
      description: '',
      startTime: start.getTime(),
      endTime: end.getTime(),
      assignedTo: 'user1',
      createdBy: 'user1',
      organizationId: 'org1',
      status: 'scheduled' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let call = 0;
    const useQueryMock = vi.fn(() => {
      call++;
      return call % 2 === 1 ? [timedEvent] : [];
    });

    vi.doMock('convex/react', () => ({
      useQuery: useQueryMock,
      useMutation: () => vi.fn(),
    }));

    const { CalendarView } = await import('@/components/calendar-view');

    const { container } = render(<CalendarView organizationId="org1" organizationMembers={[]} />);

    // Hour gutter should be present
    expect(container.querySelector('.rbc-time-gutter')).toBeInTheDocument();

    // Event should appear in the timed grid, not the all-day row
    const eventNode = await screen.findByText('Meeting');
    const eventWrapper = eventNode.closest('.rbc-event');
    expect(eventWrapper).not.toBeNull();
    expect(eventWrapper?.closest('.rbc-time-content')).toBeTruthy();
    expect(eventWrapper?.closest('.rbc-allday-cell')).toBeNull();
  });
});

