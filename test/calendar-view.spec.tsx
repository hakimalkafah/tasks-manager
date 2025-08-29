import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Calendar time grid rendering', () => {
  const setup = async (matches: boolean) => {
    vi.resetModules();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

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

    const useQueryMock = vi.fn(() => [timedEvent]);
    vi.doMock('convex/react', () => ({
      useQuery: useQueryMock,
      useMutation: () => vi.fn(),
    }));

    const { CalendarView } = await import('@/components/calendar-view');
    const utils = render(<CalendarView organizationId="org1" organizationMembers={[]} />);
    return { ...utils };
  };

  it('shows hour gutter and timed grid on mobile three-day view', async () => {
    const { container } = await setup(true);
    expect(container.querySelector('.rbc-time-gutter')).toBeInTheDocument();
    const eventNode = await screen.findByText('Meeting');
    const eventWrapper = eventNode.closest('.rbc-event');
    expect(eventWrapper).not.toBeNull();
    expect(eventWrapper?.closest('.rbc-time-content')).toBeTruthy();
    expect(eventWrapper?.closest('.rbc-allday-cell')).toBeNull();
  });

  it('shows hour gutter and timed grid on desktop week view', async () => {
    const { container } = await setup(false);
    expect(container.querySelector('.rbc-time-gutter')).toBeInTheDocument();
    const eventNode = await screen.findByText('Meeting');
    const eventWrapper = eventNode.closest('.rbc-event');
    expect(eventWrapper).not.toBeNull();
    expect(eventWrapper?.closest('.rbc-time-content')).toBeTruthy();
    expect(eventWrapper?.closest('.rbc-allday-cell')).toBeNull();
  });
});

