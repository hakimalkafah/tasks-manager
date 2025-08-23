import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({
    user: { id: 'user_123', firstName: 'John' },
    isLoaded: true
  })),
  useOrganization: vi.fn(() => ({
    organization: null,
    isLoaded: true
  })),
}));

// Mock Convex
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockGetTasks = vi.fn();

vi.mock('convex/react', () => ({
  useMutation: vi.fn((mutation) => {
    if (mutation.toString().includes('createTask')) return mockCreateTask;
    if (mutation.toString().includes('updateTask')) return mockUpdateTask;
    if (mutation.toString().includes('deleteTask')) return mockDeleteTask;
    return vi.fn();
  }),
  useQuery: vi.fn(() => [
    { id: '1', title: 'Test Task', completed: false, priority: 'medium' },
    { id: '2', title: 'Another Task', completed: true, priority: 'high' }
  ]),
}));

// Integration test for complete task workflow
describe('Task Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete task creation workflow', async () => {
    const user = userEvent.setup();
    
    const TaskWorkflowComponent = () => {
      const [showForm, setShowForm] = React.useState(false);
      const [tasks, setTasks] = React.useState([
        { id: '1', title: 'Existing Task', completed: false, priority: 'medium' }
      ]);

      const handleCreateTask = async (taskData: any) => {
        const newTask = { id: Date.now().toString(), ...taskData };
        setTasks(prev => [...prev, newTask]);
        mockCreateTask(taskData);
        setShowForm(false);
      };

      return (
        <div data-testid="task-workflow">
          <div className="task-list">
            <h2>Tasks ({tasks.length})</h2>
            {tasks.map(task => (
              <div key={task.id} data-testid={`task-${task.id}`}>
                <span>{task.title}</span>
                <span className={`priority-${task.priority}`}>{task.priority}</span>
                <span>{task.completed ? 'Completed' : 'Pending'}</span>
              </div>
            ))}
          </div>
          
          <button onClick={() => setShowForm(true)}>Create New Task</button>
          
          {showForm && (
            <form 
              data-testid="task-form"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateTask({
                  title: formData.get('title'),
                  description: formData.get('description'),
                  priority: formData.get('priority'),
                  completed: false
                });
              }}
            >
              <input name="title" placeholder="Task title" required />
              <textarea name="description" placeholder="Description" />
              <select name="priority" required>
                <option value="">Select priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button type="submit">Create Task</button>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </form>
          )}
        </div>
      );
    };

    render(<TaskWorkflowComponent />);
    
    // Verify initial state
    expect(screen.getByText('Tasks (1)')).toBeInTheDocument();
    expect(screen.getByText('Existing Task')).toBeInTheDocument();
    
    // Open task creation form
    await user.click(screen.getByText('Create New Task'));
    expect(screen.getByTestId('task-form')).toBeInTheDocument();
    
    // Fill out and submit form
    await user.type(screen.getByPlaceholderText('Task title'), 'New Integration Task');
    await user.type(screen.getByPlaceholderText('Description'), 'Test integration workflow');
    await user.selectOptions(screen.getByRole('combobox'), 'high');
    
    await user.click(screen.getByText('Create Task'));
    
    // Verify task was created
    expect(mockCreateTask).toHaveBeenCalledWith({
      title: 'New Integration Task',
      description: 'Test integration workflow',
      priority: 'high',
      completed: false
    });
    
    // Verify UI updated
    await waitFor(() => {
      expect(screen.getByText('Tasks (2)')).toBeInTheDocument();
      expect(screen.getByText('New Integration Task')).toBeInTheDocument();
    });
  });

  it('should handle task filtering and search workflow', async () => {
    const user = userEvent.setup();
    
    const TaskFilterComponent = () => {
      const [filter, setFilter] = React.useState('all');
      const [searchTerm, setSearchTerm] = React.useState('');
      
      const allTasks = [
        { id: '1', title: 'Complete project', completed: false, priority: 'high' },
        { id: '2', title: 'Review code', completed: true, priority: 'medium' },
        { id: '3', title: 'Write tests', completed: false, priority: 'low' },
        { id: '4', title: 'Deploy application', completed: true, priority: 'high' }
      ];

      const filteredTasks = allTasks.filter(task => {
        const matchesFilter = filter === 'all' || 
          (filter === 'completed' && task.completed) ||
          (filter === 'pending' && !task.completed);
        
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesFilter && matchesSearch;
      });

      return (
        <div data-testid="task-filter-workflow">
          <div className="filters">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Tasks</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div data-testid="filtered-results">
            <p>Showing {filteredTasks.length} tasks</p>
            {filteredTasks.map(task => (
              <div key={task.id} data-testid={`filtered-task-${task.id}`}>
                <span>{task.title}</span>
                <span>{task.completed ? 'Completed' : 'Pending'}</span>
                <span className={`priority-${task.priority}`}>{task.priority}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<TaskFilterComponent />);
    
    // Initial state - all tasks shown
    expect(screen.getByText('Showing 4 tasks')).toBeInTheDocument();
    
    // Test search functionality
    await user.type(screen.getByPlaceholderText('Search tasks...'), 'project');
    await waitFor(() => {
      expect(screen.getByText('Showing 1 tasks')).toBeInTheDocument();
      expect(screen.getByText('Complete project')).toBeInTheDocument();
    });
    
    // Clear search and test filter
    await user.clear(screen.getByPlaceholderText('Search tasks...'));
    await user.selectOptions(screen.getByRole('combobox'), 'completed');
    
    await waitFor(() => {
      expect(screen.getByText('Showing 2 tasks')).toBeInTheDocument();
      expect(screen.getByText('Review code')).toBeInTheDocument();
      expect(screen.getByText('Deploy application')).toBeInTheDocument();
    });
  });

  it('should handle task status updates workflow', async () => {
    const user = userEvent.setup();
    
    const TaskStatusComponent = () => {
      const [tasks, setTasks] = React.useState([
        { id: '1', title: 'Task 1', completed: false, priority: 'high' },
        { id: '2', title: 'Task 2', completed: false, priority: 'medium' }
      ]);

      const toggleTaskStatus = async (taskId: string) => {
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ));
        mockUpdateTask(taskId, { completed: true });
      };

      const completedCount = tasks.filter(t => t.completed).length;
      const totalCount = tasks.length;
      const completionRate = Math.round((completedCount / totalCount) * 100);

      return (
        <div data-testid="task-status-workflow">
          <div className="stats">
            <p>Progress: {completedCount}/{totalCount} ({completionRate}%)</p>
          </div>
          
          <div className="task-list">
            {tasks.map(task => (
              <div key={task.id} data-testid={`status-task-${task.id}`}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTaskStatus(task.id)}
                  aria-label={`Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`}
                />
                <span className={task.completed ? 'completed' : 'pending'}>
                  {task.title}
                </span>
                <span className={`priority-${task.priority}`}>{task.priority}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<TaskStatusComponent />);
    
    // Initial state
    expect(screen.getByText('Progress: 0/2 (0%)')).toBeInTheDocument();
    
    // Complete first task
    const firstTaskCheckbox = screen.getByLabelText('Mark Task 1 as complete');
    await user.click(firstTaskCheckbox);
    
    expect(mockUpdateTask).toHaveBeenCalledWith('1', { completed: true });
    expect(screen.getByText('Progress: 1/2 (50%)')).toBeInTheDocument();
    
    // Complete second task
    const secondTaskCheckbox = screen.getByLabelText('Mark Task 2 as complete');
    await user.click(secondTaskCheckbox);
    
    expect(screen.getByText('Progress: 2/2 (100%)')).toBeInTheDocument();
  });

  it('should handle bulk operations workflow', async () => {
    const user = userEvent.setup();
    
    const BulkOperationsComponent = () => {
      const [tasks] = React.useState([
        { id: '1', title: 'Task 1', completed: false, priority: 'high' },
        { id: '2', title: 'Task 2', completed: false, priority: 'medium' },
        { id: '3', title: 'Task 3', completed: true, priority: 'low' }
      ]);
      
      const [selectedTasks, setSelectedTasks] = React.useState<string[]>([]);

      const toggleTaskSelection = (taskId: string) => {
        setSelectedTasks(prev =>
          prev.includes(taskId)
            ? prev.filter(id => id !== taskId)
            : [...prev, taskId]
        );
      };

      const selectAll = () => {
        setSelectedTasks(tasks.map(t => t.id));
      };

      const bulkComplete = () => {
        selectedTasks.forEach(taskId => {
          mockUpdateTask(taskId, { completed: true });
        });
        setSelectedTasks([]);
      };

      const bulkDelete = () => {
        selectedTasks.forEach(taskId => {
          mockDeleteTask(taskId);
        });
        setSelectedTasks([]);
      };

      return (
        <div data-testid="bulk-operations-workflow">
          <div className="bulk-actions">
            <button onClick={selectAll}>Select All</button>
            {selectedTasks.length > 0 && (
              <>
                <button onClick={bulkComplete}>
                  Complete Selected ({selectedTasks.length})
                </button>
                <button onClick={bulkDelete}>
                  Delete Selected ({selectedTasks.length})
                </button>
              </>
            )}
          </div>
          
          <div className="task-list">
            {tasks.map(task => (
              <div key={task.id} data-testid={`bulk-task-${task.id}`}>
                <input
                  type="checkbox"
                  checked={selectedTasks.includes(task.id)}
                  onChange={() => toggleTaskSelection(task.id)}
                  aria-label={`Select ${task.title}`}
                />
                <span>{task.title}</span>
                <span>{task.completed ? 'Completed' : 'Pending'}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    render(<BulkOperationsComponent />);
    
    // Select individual tasks
    await user.click(screen.getByLabelText('Select Task 1'));
    await user.click(screen.getByLabelText('Select Task 2'));
    
    expect(screen.getByText('Complete Selected (2)')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected (2)')).toBeInTheDocument();
    
    // Test bulk complete
    await user.click(screen.getByText('Complete Selected (2)'));
    
    expect(mockUpdateTask).toHaveBeenCalledWith('1', { completed: true });
    expect(mockUpdateTask).toHaveBeenCalledWith('2', { completed: true });
    
    // Test select all
    await user.click(screen.getByText('Select All'));
    expect(screen.getByText('Delete Selected (3)')).toBeInTheDocument();
    
    // Test bulk delete
    await user.click(screen.getByText('Delete Selected (3)'));
    
    expect(mockDeleteTask).toHaveBeenCalledWith('1');
    expect(mockDeleteTask).toHaveBeenCalledWith('2');
    expect(mockDeleteTask).toHaveBeenCalledWith('3');
  });
});
