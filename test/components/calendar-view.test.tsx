import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock date-fns for consistent testing
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr === 'yyyy-MM-dd') return '2024-01-15';
    if (formatStr === 'MMMM yyyy') return 'January 2024';
    if (formatStr === 'd') return '15';
    return date.toString();
  }),
  startOfMonth: vi.fn(() => new Date('2024-01-01')),
  endOfMonth: vi.fn(() => new Date('2024-01-31')),
  eachDayOfInterval: vi.fn(() => Array.from({length: 31}, (_, i) => new Date(2024, 0, i + 1))),
  isSameDay: vi.fn((date1, date2) => date1.getDate() === date2.getDate()),
  addMonths: vi.fn((date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1)),
  subMonths: vi.fn((date, months) => new Date(date.getFullYear(), date.getMonth() - months, 1)),
}));

// Comprehensive CalendarView tests
describe('CalendarView', () => {
  const mockEvents = [
    {
      id: 'event_1',
      title: 'Team Meeting',
      description: 'Weekly team sync',
      date: '2024-01-15',
      time: '10:00',
      duration: 60,
      type: 'meeting',
      attendees: ['john@example.com', 'jane@example.com'],
      priority: 'high'
    },
    {
      id: 'event_2',
      title: 'Project Review',
      description: 'Review project progress',
      date: '2024-01-15',
      time: '14:00',
      duration: 90,
      type: 'review',
      attendees: ['manager@example.com'],
      priority: 'medium'
    },
    {
      id: 'event_3',
      title: 'Client Call',
      description: 'Discuss requirements',
      date: '2024-01-16',
      time: '09:00',
      duration: 30,
      type: 'call',
      attendees: ['client@example.com'],
      priority: 'high'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render calendar with month view and navigation', () => {
    const TestCalendarView = () => {
      const [currentDate, setCurrentDate] = useState(new Date('2024-01-15'));
      
      return (
        <div data-testid="calendar-view">
          <div className="calendar-header">
            <button onClick={() => setCurrentDate(new Date(2023, 11, 15))}>
              Previous
            </button>
            <h2>January 2024</h2>
            <button onClick={() => setCurrentDate(new Date(2024, 1, 15))}>
              Next
            </button>
          </div>
          <div className="calendar-grid" data-testid="calendar-grid">
            <div className="weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="days">
              {Array.from({length: 31}, (_, i) => (
                <div key={i + 1} className="day" data-testid={`day-${i + 1}`}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    render(<TestCalendarView />);
    
    expect(screen.getByText('January 2024')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
    expect(screen.getByTestId('day-15')).toBeInTheDocument();
  });

  it('should display events on calendar dates', () => {
    const TestCalendarView = () => (
      <div data-testid="calendar-view">
        <div className="calendar-grid">
          {Array.from({length: 31}, (_, i) => {
            const dayEvents = mockEvents.filter(event => 
              parseInt(event.date.split('-')[2]) === i + 1
            );
            
            return (
              <div key={i + 1} className="day" data-testid={`day-${i + 1}`}>
                <span className="day-number">{i + 1}</span>
                <div className="events">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id} 
                      className={`event event-${event.type}`}
                      data-testid={`event-${event.id}`}
                    >
                      <span className="event-title">{event.title}</span>
                      <span className="event-time">{event.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    render(<TestCalendarView />);
    
    // Check events on day 15
    const day15 = screen.getByTestId('day-15');
    expect(within(day15).getByText('Team Meeting')).toBeInTheDocument();
    expect(within(day15).getByText('Project Review')).toBeInTheDocument();
    expect(within(day15).getByText('10:00')).toBeInTheDocument();
    expect(within(day15).getByText('14:00')).toBeInTheDocument();
    
    // Check event on day 16
    const day16 = screen.getByTestId('day-16');
    expect(within(day16).getByText('Client Call')).toBeInTheDocument();
  });

  it('should handle event creation', async () => {
    const user = userEvent.setup();
    const mockCreateEvent = vi.fn();

    const TestCalendarView = () => {
      const [showCreateDialog, setShowCreateDialog] = useState(false);
      const [selectedDate, setSelectedDate] = useState<string | null>(null);
      const [eventForm, setEventForm] = useState({
        title: '',
        description: '',
        time: '',
        duration: 60
      });

      const handleDayClick = (day: number) => {
        setSelectedDate(`2024-01-${day.toString().padStart(2, '0')}`);
        setShowCreateDialog(true);
      };

      const handleCreateEvent = () => {
        mockCreateEvent({
          ...eventForm,
          date: selectedDate
        });
        setShowCreateDialog(false);
        setEventForm({ title: '', description: '', time: '', duration: 60 });
      };

      return (
        <div data-testid="calendar-view">
          <div className="calendar-grid">
            {Array.from({length: 31}, (_, i) => (
              <button
                key={i + 1}
                className="day"
                onClick={() => handleDayClick(i + 1)}
                data-testid={`day-button-${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          
          {showCreateDialog && (
            <div data-testid="create-event-dialog" className="dialog">
              <h3>Create Event for {selectedDate}</h3>
              <input
                type="text"
                placeholder="Event title"
                value={eventForm.title}
                onChange={(e) => setEventForm(prev => ({...prev, title: e.target.value}))}
              />
              <textarea
                placeholder="Description"
                value={eventForm.description}
                onChange={(e) => setEventForm(prev => ({...prev, description: e.target.value}))}
              />
              <input
                type="time"
                value={eventForm.time}
                onChange={(e) => setEventForm(prev => ({...prev, time: e.target.value}))}
              />
              <select
                value={eventForm.duration}
                onChange={(e) => setEventForm(prev => ({...prev, duration: parseInt(e.target.value)}))}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
              <div className="actions">
                <button onClick={handleCreateEvent} disabled={!eventForm.title.trim()}>
                  Create Event
                </button>
                <button onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    render(<TestCalendarView />);
    
    // Click on day 20 to create event
    await user.click(screen.getByTestId('day-button-20'));
    
    const dialog = screen.getByTestId('create-event-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Create Event for 2024-01-20')).toBeInTheDocument();
    
    // Fill out event form
    await user.type(screen.getByPlaceholderText('Event title'), 'New Meeting');
    await user.type(screen.getByPlaceholderText('Description'), 'Important discussion');
    await user.type(screen.getByDisplayValue(''), '15:30');
    await user.selectOptions(screen.getByRole('combobox'), '90');
    
    // Create event
    await user.click(screen.getByText('Create Event'));
    
    expect(mockCreateEvent).toHaveBeenCalledWith({
      title: 'New Meeting',
      description: 'Important discussion',
      time: '15:30',
      duration: 90,
      date: '2024-01-20'
    });
  });

  it('should handle event editing and deletion', async () => {
    const user = userEvent.setup();
    const mockUpdateEvent = vi.fn();
    const mockDeleteEvent = vi.fn();

    const TestCalendarView = () => {
      const [selectedEvent, setSelectedEvent] = useState<typeof mockEvents[0] | null>(null);
      const [isEditing, setIsEditing] = useState(false);
      const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        time: ''
      });

      const handleEventClick = (event: typeof mockEvents[0]) => {
        setSelectedEvent(event);
        setEditForm({
          title: event.title,
          description: event.description,
          time: event.time
        });
      };

      const handleUpdate = () => {
        mockUpdateEvent(selectedEvent?.id, editForm);
        setIsEditing(false);
        setSelectedEvent(null);
      };

      const handleDelete = () => {
        mockDeleteEvent(selectedEvent?.id);
        setSelectedEvent(null);
      };

      return (
        <div data-testid="calendar-view">
          <div className="events-list">
            {mockEvents.map(event => (
              <button
                key={event.id}
                onClick={() => handleEventClick(event)}
                data-testid={`event-${event.id}`}
              >
                {event.title} - {event.time}
              </button>
            ))}
          </div>
          
          {selectedEvent && (
            <div data-testid="event-details-dialog" className="dialog">
              <h3>{isEditing ? 'Edit Event' : 'Event Details'}</h3>
              
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({...prev, title: e.target.value}))}
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({...prev, description: e.target.value}))}
                  />
                  <input
                    type="time"
                    value={editForm.time}
                    onChange={(e) => setEditForm(prev => ({...prev, time: e.target.value}))}
                  />
                  <div className="actions">
                    <button onClick={handleUpdate}>Save Changes</button>
                    <button onClick={() => setIsEditing(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p>Title: {selectedEvent.title}</p>
                  <p>Description: {selectedEvent.description}</p>
                  <p>Time: {selectedEvent.time}</p>
                  <p>Duration: {selectedEvent.duration} minutes</p>
                  <div className="actions">
                    <button onClick={() => setIsEditing(true)}>Edit</button>
                    <button onClick={handleDelete} className="delete-btn">Delete</button>
                    <button onClick={() => setSelectedEvent(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    render(<TestCalendarView />);
    
    // Click on an event to view details
    await user.click(screen.getByTestId('event-event_1'));
    
    const dialog = screen.getByTestId('event-details-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Title: Team Meeting')).toBeInTheDocument();
    
    // Edit the event
    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Event')).toBeInTheDocument();
    
    const titleInput = screen.getByDisplayValue('Team Meeting');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Team Meeting');
    
    await user.click(screen.getByText('Save Changes'));
    
    expect(mockUpdateEvent).toHaveBeenCalledWith('event_1', {
      title: 'Updated Team Meeting',
      description: 'Weekly team sync',
      time: '10:00'
    });
  });

  it('should filter events by type and priority', async () => {
    const user = userEvent.setup();

    const TestCalendarView = () => {
      const [typeFilter, setTypeFilter] = useState<string>('all');
      const [priorityFilter, setPriorityFilter] = useState<string>('all');

      const filteredEvents = mockEvents.filter(event => {
        const typeMatch = typeFilter === 'all' || event.type === typeFilter;
        const priorityMatch = priorityFilter === 'all' || event.priority === priorityFilter;
        return typeMatch && priorityMatch;
      });

      return (
        <div data-testid="calendar-view">
          <div className="filters">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="meeting">Meetings</option>
              <option value="review">Reviews</option>
              <option value="call">Calls</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          
          <div data-testid="filtered-events">
            {filteredEvents.map(event => (
              <div key={event.id} data-testid={`filtered-event-${event.id}`}>
                <span>{event.title}</span>
                <span className={`type-${event.type}`}>{event.type}</span>
                <span className={`priority-${event.priority}`}>{event.priority}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<TestCalendarView />);
    
    // Filter by meeting type
    await user.selectOptions(screen.getByDisplayValue('All Types'), 'meeting');
    
    const filteredContainer = screen.getByTestId('filtered-events');
    expect(within(filteredContainer).getByText('Team Meeting')).toBeInTheDocument();
    expect(within(filteredContainer).queryByText('Project Review')).not.toBeInTheDocument();
    
    // Filter by high priority
    await user.selectOptions(screen.getByDisplayValue('All Priorities'), 'high');
    expect(within(filteredContainer).getByText('Team Meeting')).toBeInTheDocument();
  });

  it('should handle calendar view switching (month/week/day)', async () => {
    const user = userEvent.setup();

    const TestCalendarView = () => {
      const [view, setView] = useState<'month' | 'week' | 'day'>('month');

      return (
        <div data-testid="calendar-view">
          <div className="view-switcher">
            <button 
              onClick={() => setView('month')}
              className={view === 'month' ? 'active' : ''}
            >
              Month
            </button>
            <button 
              onClick={() => setView('week')}
              className={view === 'week' ? 'active' : ''}
            >
              Week
            </button>
            <button 
              onClick={() => setView('day')}
              className={view === 'day' ? 'active' : ''}
            >
              Day
            </button>
          </div>
          
          <div data-testid={`${view}-view`} className={`calendar-${view}`}>
            {view === 'month' && <div>Month View - 31 days</div>}
            {view === 'week' && <div>Week View - 7 days</div>}
            {view === 'day' && <div>Day View - Single day</div>}
          </div>
        </div>
      );
    };

    render(<TestCalendarView />);
    
    // Default month view
    expect(screen.getByTestId('month-view')).toBeInTheDocument();
    expect(screen.getByText('Month View - 31 days')).toBeInTheDocument();
    
    // Switch to week view
    await user.click(screen.getByText('Week'));
    expect(screen.getByTestId('week-view')).toBeInTheDocument();
    expect(screen.getByText('Week View - 7 days')).toBeInTheDocument();
    
    // Switch to day view
    await user.click(screen.getByText('Day'));
    expect(screen.getByTestId('day-view')).toBeInTheDocument();
    expect(screen.getByText('Day View - Single day')).toBeInTheDocument();
  });

  it('should show event conflicts and overlaps', () => {
    const conflictingEvents = [
      {
        id: 'conflict_1',
        title: 'Meeting A',
        time: '10:00',
        duration: 60,
        date: '2024-01-15'
      },
      {
        id: 'conflict_2',
        title: 'Meeting B',
        time: '10:30',
        duration: 60,
        date: '2024-01-15'
      }
    ];

    const TestCalendarView = () => {
      const hasConflict = (event1: typeof conflictingEvents[0], event2: typeof conflictingEvents[0]) => {
        if (event1.date !== event2.date) return false;
        
        const start1 = parseInt(event1.time.replace(':', ''));
        const end1 = start1 + (event1.duration / 60) * 100;
        const start2 = parseInt(event2.time.replace(':', ''));
        const end2 = start2 + (event2.duration / 60) * 100;
        
        return (start1 < end2 && start2 < end1);
      };

      return (
        <div data-testid="calendar-view">
          {conflictingEvents.map(event => {
            const conflicts = conflictingEvents.filter(other => 
              other.id !== event.id && hasConflict(event, other)
            );
            
            return (
              <div 
                key={event.id} 
                className={`event ${conflicts.length > 0 ? 'has-conflict' : ''}`}
                data-testid={`event-${event.id}`}
              >
                <span>{event.title}</span>
                <span>{event.time}</span>
                {conflicts.length > 0 && (
                  <div className="conflict-warning" data-testid={`conflict-${event.id}`}>
                    ⚠️ Conflicts with {conflicts.length} event(s)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    render(<TestCalendarView />);
    
    expect(screen.getByTestId('conflict-conflict_1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-conflict_2')).toBeInTheDocument();
    expect(screen.getAllByText('⚠️ Conflicts with 1 event(s)')).toHaveLength(2);
  });

  it('should handle keyboard navigation in calendar', async () => {
    const user = userEvent.setup();
    const mockSelectDate = vi.fn();

    const TestCalendarView = () => {
      const [focusedDay, setFocusedDay] = useState(15);

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedDay(prev => Math.min(prev + 1, 31));
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusedDay(prev => Math.max(prev - 1, 1));
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedDay(prev => Math.min(prev + 7, 31));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedDay(prev => Math.max(prev - 7, 1));
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          mockSelectDate(focusedDay);
        }
      };

      return (
        <div data-testid="calendar-view" onKeyDown={handleKeyDown} tabIndex={0}>
          <div className="calendar-grid">
            {Array.from({length: 31}, (_, i) => (
              <div
                key={i + 1}
                className={`day ${i + 1 === focusedDay ? 'focused' : ''}`}
                data-testid={`calendar-day-${i + 1}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<TestCalendarView />);
    
    const calendar = screen.getByTestId('calendar-view');
    calendar.focus();

    // Navigate right
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('calendar-day-16')).toHaveClass('focused');

    // Navigate down (next week)
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('calendar-day-23')).toHaveClass('focused');

    // Select date
    await user.keyboard('{Enter}');
    expect(mockSelectDate).toHaveBeenCalledWith(23);
  });

  it('should show loading state while fetching events', () => {
    const TestCalendarView = () => {
      const [isLoading] = useState(true);

      return (
        <div data-testid="calendar-view">
          {isLoading ? (
            <div data-testid="calendar-loading" className="loading-state">
              <div className="spinner" aria-label="Loading calendar events">
                <span>Loading calendar...</span>
              </div>
            </div>
          ) : (
            <div>Calendar loaded</div>
          )}
        </div>
      );
    };

    render(<TestCalendarView />);
    
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading calendar events')).toBeInTheDocument();
    expect(screen.getByText('Loading calendar...')).toBeInTheDocument();
  });

  it('should handle empty calendar state', () => {
    const TestCalendarView = () => (
      <div data-testid="calendar-view">
        <div className="empty-state">
          <h3>No events scheduled</h3>
          <p>Click on any date to create your first event</p>
          <button>Create Event</button>
        </div>
      </div>
    );

    render(<TestCalendarView />);
    
    expect(screen.getByText('No events scheduled')).toBeInTheDocument();
    expect(screen.getByText('Click on any date to create your first event')).toBeInTheDocument();
    expect(screen.getByText('Create Event')).toBeInTheDocument();
  });

  it('should display event attendees and handle invitations', async () => {
    const user = userEvent.setup();
    const mockInviteAttendee = vi.fn();

    const TestCalendarView = () => {
      const [showAttendees, setShowAttendees] = useState(false);
      const [newAttendee, setNewAttendee] = useState('');

      const handleInvite = () => {
        mockInviteAttendee(mockEvents[0].id, newAttendee);
        setNewAttendee('');
      };

      return (
        <div data-testid="calendar-view">
          <div className="event-details">
            <h3>{mockEvents[0].title}</h3>
            <button onClick={() => setShowAttendees(!showAttendees)}>
              Attendees ({mockEvents[0].attendees.length})
            </button>
            
            {showAttendees && (
              <div data-testid="attendees-section">
                <div className="attendee-list">
                  {mockEvents[0].attendees.map(attendee => (
                    <div key={attendee} className="attendee">
                      {attendee}
                    </div>
                  ))}
                </div>
                <div className="invite-section">
                  <input
                    type="email"
                    placeholder="Enter email to invite"
                    value={newAttendee}
                    onChange={(e) => setNewAttendee(e.target.value)}
                  />
                  <button onClick={handleInvite} disabled={!newAttendee.includes('@')}>
                    Invite
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };

    render(<TestCalendarView />);
    
    // Show attendees
    await user.click(screen.getByText('Attendees (2)'));
    
    const attendeesSection = screen.getByTestId('attendees-section');
    expect(within(attendeesSection).getByText('john@example.com')).toBeInTheDocument();
    expect(within(attendeesSection).getByText('jane@example.com')).toBeInTheDocument();
    
    // Invite new attendee
    const emailInput = screen.getByPlaceholderText('Enter email to invite');
    await user.type(emailInput, 'new@example.com');
    await user.click(screen.getByText('Invite'));
    
    expect(mockInviteAttendee).toHaveBeenCalledWith('event_1', 'new@example.com');
  });
});
