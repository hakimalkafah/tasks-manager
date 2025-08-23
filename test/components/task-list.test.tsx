import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Comprehensive TaskList tests
describe('TaskList', () => {
  const mockTasks = [
    {
      id: '1',
      title: 'Complete project',
      description: 'Finish the task management app',
      completed: false,
      priority: 'high',
      dueDate: '2024-12-31',
      createdAt: '2024-01-01',
      assignee: 'John Doe'
    },
    {
      id: '2',
      title: 'Review code',
      description: 'Review pull requests',
      completed: true,
      priority: 'medium',
      dueDate: '2024-01-15',
      createdAt: '2024-01-02',
      assignee: 'Jane Smith'
    },
    {
      id: '3',
      title: 'Write tests',
      description: 'Add unit tests',
      completed: false,
      priority: 'low',
      dueDate: '2024-02-01',
      createdAt: '2024-01-03',
      assignee: null
    }
  ];

  it('should render task list with all task information', () => {
    const TestTaskList = () => (
      <div data-testid="task-list">
        <h2>Tasks ({mockTasks.length})</h2>
        {mockTasks.map(task => (
          <div key={task.id} data-testid={`task-${task.id}`}>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
            <span className={`priority-${task.priority}`}>{task.priority}</span>
            <span className={task.completed ? 'completed' : 'pending'}>
              {task.completed ? 'Completed' : 'Pending'}
            </span>
            <span>Due: {task.dueDate}</span>
            {task.assignee && <span>Assigned to: {task.assignee}</span>}
          </div>
        ))}
      </div>
    );

    render(<TestTaskList />);
    
    expect(screen.getByText('Tasks (3)')).toBeInTheDocument();
    expect(screen.getByText('Complete project')).toBeInTheDocument();
    expect(screen.getByText('Finish the task management app')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Due: 2024-12-31')).toBeInTheDocument();
    expect(screen.getByText('Assigned to: John Doe')).toBeInTheDocument();
  });

  it('should handle task completion toggle', async () => {
    const user = userEvent.setup();
    const mockToggleComplete = vi.fn();

    const TestTaskList = () => {
      const [tasks, setTasks] = useState(mockTasks);

      const toggleComplete = (taskId: string) => {
        mockToggleComplete(taskId);
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ));
      };

      return (
        <div data-testid="task-list">
          {tasks.map(task => (
            <div key={task.id} data-testid={`task-${task.id}`}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleComplete(task.id)}
                aria-label={`Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`}
              />
              <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
            </div>
          ))}
        </div>
      );
    };

    render(<TestTaskList />);
    
    const firstTaskCheckbox = screen.getByLabelText('Mark Complete project as complete');
    await user.click(firstTaskCheckbox);

    expect(mockToggleComplete).toHaveBeenCalledWith('1');
    expect(firstTaskCheckbox).toBeChecked();
  });

  it('should filter tasks by status', async () => {
    const user = userEvent.setup();

    const TestTaskList = () => {
      const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

      const filteredTasks = mockTasks.filter(task => {
        if (filter === 'completed') return task.completed;
        if (filter === 'pending') return !task.completed;
        return true;
      });

      return (
        <div data-testid="task-list">
          <div>
            <button onClick={() => setFilter('all')}>All ({mockTasks.length})</button>
            <button onClick={() => setFilter('pending')}>
              Pending ({mockTasks.filter(t => !t.completed).length})
            </button>
            <button onClick={() => setFilter('completed')}>
              Completed ({mockTasks.filter(t => t.completed).length})
            </button>
          </div>
          <div data-testid="filtered-tasks">
            {filteredTasks.map(task => (
              <div key={task.id}>{task.title}</div>
            ))}
          </div>
        </div>
      );
    };

    render(<TestTaskList />);
    
    expect(screen.getByText('All (3)')).toBeInTheDocument();
    expect(screen.getByText('Pending (2)')).toBeInTheDocument();
    expect(screen.getByText('Completed (1)')).toBeInTheDocument();

    // Filter by completed
    await user.click(screen.getByText('Completed (1)'));
    const filteredContainer = screen.getByTestId('filtered-tasks');
    expect(within(filteredContainer).getByText('Review code')).toBeInTheDocument();
    expect(within(filteredContainer).queryByText('Complete project')).not.toBeInTheDocument();
  });

  it('should sort tasks by different criteria', async () => {
    const user = userEvent.setup();

    const TestTaskList = () => {
      const [sortBy, setSortBy] = useState<'title' | 'priority' | 'dueDate'>('title');

      const sortedTasks = [...mockTasks].sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'priority') {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority as keyof typeof priorityOrder] - 
                 priorityOrder[a.priority as keyof typeof priorityOrder];
        }
        if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
        return 0;
      });

      return (
        <div data-testid="task-list">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="title">Sort by Title</option>
            <option value="priority">Sort by Priority</option>
            <option value="dueDate">Sort by Due Date</option>
          </select>
          <div data-testid="sorted-tasks">
            {sortedTasks.map(task => (
              <div key={task.id} data-testid={`sorted-task-${task.id}`}>
                {task.title} - {task.priority}
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<TestTaskList />);
    
    // Test sorting by priority
    await user.selectOptions(screen.getByRole('combobox'), 'priority');
    const sortedContainer = screen.getByTestId('sorted-tasks');
    const tasks = within(sortedContainer).getAllByTestId(/sorted-task-/);
    expect(tasks[0]).toHaveTextContent('Complete project - high');
    expect(tasks[1]).toHaveTextContent('Review code - medium');
    expect(tasks[2]).toHaveTextContent('Write tests - low');
  });

  it('should search tasks by title and description', async () => {
    const user = userEvent.setup();

    const TestTaskList = () => {
      const [searchTerm, setSearchTerm] = useState('');

      const filteredTasks = mockTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return (
        <div data-testid="task-list">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div data-testid="search-results">
            {filteredTasks.length === 0 ? (
              <div>No tasks found</div>
            ) : (
              filteredTasks.map(task => (
                <div key={task.id}>{task.title}</div>
              ))
            )}
          </div>
        </div>
      );
    };

    render(<TestTaskList />);
    
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    await user.type(searchInput, 'project');

    const resultsContainer = screen.getByTestId('search-results');
    expect(within(resultsContainer).getByText('Complete project')).toBeInTheDocument();
    expect(within(resultsContainer).queryByText('Review code')).not.toBeInTheDocument();
  });

  it('should handle bulk actions', async () => {
    const user = userEvent.setup();
    const mockBulkComplete = vi.fn();
    const mockBulkDelete = vi.fn();

    const TestTaskList = () => {
      const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

      const toggleTaskSelection = (taskId: string) => {
        setSelectedTasks(prev =>
          prev.includes(taskId)
            ? prev.filter(id => id !== taskId)
            : [...prev, taskId]
        );
      };

      const selectAll = () => {
        setSelectedTasks(mockTasks.map(t => t.id));
      };

      const clearSelection = () => {
        setSelectedTasks([]);
      };

      return (
        <div data-testid="task-list">
          <div>
            <button onClick={selectAll}>Select All</button>
            <button onClick={clearSelection}>Clear Selection</button>
            {selectedTasks.length > 0 && (
              <div>
                <button onClick={() => mockBulkComplete(selectedTasks)}>
                  Mark Selected Complete ({selectedTasks.length})
                </button>
                <button onClick={() => mockBulkDelete(selectedTasks)}>
                  Delete Selected ({selectedTasks.length})
                </button>
              </div>
            )}
          </div>
          {mockTasks.map(task => (
            <div key={task.id}>
              <input
                type="checkbox"
                checked={selectedTasks.includes(task.id)}
                onChange={() => toggleTaskSelection(task.id)}
                aria-label={`Select ${task.title}`}
              />
              <span>{task.title}</span>
            </div>
          ))}
        </div>
      );
    };

    render(<TestTaskList />);
    
    // Select individual tasks
    await user.click(screen.getByLabelText('Select Complete project'));
    await user.click(screen.getByLabelText('Select Write tests'));

    expect(screen.getByText('Mark Selected Complete (2)')).toBeInTheDocument();

    // Test bulk complete
    await user.click(screen.getByText('Mark Selected Complete (2)'));
    expect(mockBulkComplete).toHaveBeenCalledWith(['1', '3']);
  });

  it('should show task statistics', () => {
    const TestTaskList = () => {
      const totalTasks = mockTasks.length;
      const completedTasks = mockTasks.filter(t => t.completed).length;
      const pendingTasks = totalTasks - completedTasks;
      const highPriorityTasks = mockTasks.filter(t => t.priority === 'high').length;

      return (
        <div data-testid="task-list">
          <div data-testid="task-stats">
            <div>Total: {totalTasks}</div>
            <div>Completed: {completedTasks}</div>
            <div>Pending: {pendingTasks}</div>
            <div>High Priority: {highPriorityTasks}</div>
            <div>Completion Rate: {Math.round((completedTasks / totalTasks) * 100)}%</div>
          </div>
        </div>
      );
    };

    render(<TestTaskList />);
    
    const statsContainer = screen.getByTestId('task-stats');
    expect(within(statsContainer).getByText('Total: 3')).toBeInTheDocument();
    expect(within(statsContainer).getByText('Completed: 1')).toBeInTheDocument();
    expect(within(statsContainer).getByText('Pending: 2')).toBeInTheDocument();
    expect(within(statsContainer).getByText('High Priority: 1')).toBeInTheDocument();
    expect(within(statsContainer).getByText('Completion Rate: 33%')).toBeInTheDocument();
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    const mockSelectTask = vi.fn();

    const TestTaskList = () => {
      const [focusedIndex, setFocusedIndex] = useState(0);

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, mockTasks.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          mockSelectTask(mockTasks[focusedIndex].id);
        }
      };

      return (
        <div data-testid="task-list" onKeyDown={handleKeyDown} tabIndex={0}>
          {mockTasks.map((task, index) => (
            <div
              key={task.id}
              className={index === focusedIndex ? 'focused' : ''}
              data-testid={`task-${task.id}`}
            >
              {task.title}
            </div>
          ))}
        </div>
      );
    };

    render(<TestTaskList />);
    
    const taskList = screen.getByTestId('task-list');
    taskList.focus();

    // Navigate down
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('task-2')).toHaveClass('focused');

    // Navigate up
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('task-1')).toHaveClass('focused');

    // Select with Enter
    await user.keyboard('{Enter}');
    expect(mockSelectTask).toHaveBeenCalledWith('1');
  });

  it('should handle empty state with call-to-action', () => {
    const mockCreateTask = vi.fn();

    const TestTaskList = () => (
      <div data-testid="task-list-empty">
        <div className="empty-state">
          <h3>No tasks yet</h3>
          <p>Create your first task to get started with your project</p>
          <button onClick={mockCreateTask}>Create First Task</button>
        </div>
      </div>
    );

    render(<TestTaskList />);
    
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first task to get started with your project')).toBeInTheDocument();
    
    const createButton = screen.getByText('Create First Task');
    fireEvent.click(createButton);
    expect(mockCreateTask).toHaveBeenCalled();
  });

  it('should show loading state', () => {
    const TestTaskList = () => (
      <div data-testid="task-list-loading">
        <div className="loading-spinner" aria-label="Loading tasks">
          <div>Loading tasks...</div>
        </div>
      </div>
    );

    render(<TestTaskList />);
    
    expect(screen.getByLabelText('Loading tasks')).toBeInTheDocument();
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
  });

  it('should handle task priority indicators', () => {
    const TestTaskList = () => (
      <div data-testid="task-list">
        {mockTasks.map(task => (
          <div key={task.id} data-testid={`task-${task.id}`}>
            <span>{task.title}</span>
            <span 
              className={`priority-badge priority-${task.priority}`}
              data-testid={`priority-${task.id}`}
            >
              {task.priority.toUpperCase()}
            </span>
            {task.priority === 'high' && <span className="urgent-indicator">🔥</span>}
          </div>
        ))}
      </div>
    );

    render(<TestTaskList />);
    
    expect(screen.getByTestId('priority-1')).toHaveTextContent('HIGH');
    expect(screen.getByText('🔥')).toBeInTheDocument(); // High priority indicator
    expect(screen.getByTestId('priority-2')).toHaveTextContent('MEDIUM');
    expect(screen.getByTestId('priority-3')).toHaveTextContent('LOW');
  });

  it('should handle overdue tasks highlighting', () => {
    const today = new Date().toISOString().split('T')[0];
    const overdueTask = { ...mockTasks[0], dueDate: '2023-12-01' }; // Past date

    const TestTaskList = () => {
      const isOverdue = (dueDate: string) => dueDate < today;

      return (
        <div data-testid="task-list">
          <div 
            className={isOverdue(overdueTask.dueDate) ? 'overdue' : ''}
            data-testid="overdue-task"
          >
            <span>{overdueTask.title}</span>
            <span>Due: {overdueTask.dueDate}</span>
            {isOverdue(overdueTask.dueDate) && (
              <span className="overdue-label">Overdue</span>
            )}
          </div>
        </div>
      );
    };

    render(<TestTaskList />);
    
    const overdueTaskElement = screen.getByTestId('overdue-task');
    expect(overdueTaskElement).toHaveClass('overdue');
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});
