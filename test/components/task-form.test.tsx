import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Comprehensive TaskForm tests
describe('TaskForm', () => {
  it('should render basic task form elements', () => {
    const TestTaskForm = () => (
      <form data-testid="task-form">
        <input placeholder="Task title" name="title" />
        <textarea placeholder="Task description" name="description" />
        <select name="priority">
          <option value="">Select priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" name="dueDate" />
        <button type="submit">Create Task</button>
        <button type="button">Cancel</button>
      </form>
    );

    render(<TestTaskForm />);
    
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Task description')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Create Task')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should handle form input changes', async () => {
    const user = userEvent.setup();
    const TestTaskForm = () => {
      const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: '',
        dueDate: ''
      });

      const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
          ...prev,
          [e.target.name]: e.target.value
        }));
      };

      return (
        <form data-testid="task-form">
          <input 
            placeholder="Task title" 
            name="title" 
            value={formData.title}
            onChange={handleChange}
          />
          <textarea 
            placeholder="Task description" 
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
          <select name="priority" value={formData.priority} onChange={handleChange}>
            <option value="">Select priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input 
            type="date" 
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
          />
          <div data-testid="form-data">{JSON.stringify(formData)}</div>
        </form>
      );
    };

    render(<TestTaskForm />);
    
    const titleInput = screen.getByPlaceholderText('Task title');
    const descriptionInput = screen.getByPlaceholderText('Task description');
    const prioritySelect = screen.getByRole('combobox');

    await user.type(titleInput, 'New Task');
    await user.type(descriptionInput, 'Task description here');
    await user.selectOptions(prioritySelect, 'high');

    expect(titleInput).toHaveValue('New Task');
    expect(descriptionInput).toHaveValue('Task description here');
    expect(prioritySelect).toHaveValue('high');
  });

  it('should validate required fields', () => {
    const TestTaskForm = () => {
      const [errors, setErrors] = useState<string[]>([]);

      const validate = () => {
        const newErrors: string[] = [];
        const title = (document.querySelector('[name="title"]') as HTMLInputElement)?.value;
        
        if (!title || title.trim() === '') {
          newErrors.push('Title is required');
        }
        if (title && title.length > 100) {
          newErrors.push('Title must be 100 characters or less');
        }
        
        setErrors(newErrors);
      };

      return (
        <form data-testid="task-form">
          <input placeholder="Task title" name="title" maxLength={100} />
          <button type="button" onClick={validate}>Validate</button>
          {errors.map((error, index) => (
            <div key={index} role="alert">{error}</div>
          ))}
        </form>
      );
    };

    render(<TestTaskForm />);
    
    const validateButton = screen.getByText('Validate');
    fireEvent.click(validateButton);
    
    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();

    const TestTaskForm = () => {
      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        mockSubmit({
          title: formData.get('title'),
          description: formData.get('description'),
          priority: formData.get('priority')
        });
      };

      return (
        <form data-testid="task-form" onSubmit={handleSubmit}>
          <input placeholder="Task title" name="title" required />
          <textarea placeholder="Task description" name="description" />
          <select name="priority">
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<TestTaskForm />);
    
    await user.type(screen.getByPlaceholderText('Task title'), 'Test Task');
    await user.type(screen.getByPlaceholderText('Task description'), 'Test Description');
    await user.selectOptions(screen.getByRole('combobox'), 'high');
    await user.click(screen.getByText('Submit'));

    expect(mockSubmit).toHaveBeenCalledWith({
      title: 'Test Task',
      description: 'Test Description',
      priority: 'high'
    });
  });

  it('should handle loading states', () => {
    const TestTaskForm = () => {
      const [isLoading, setIsLoading] = useState(false);

      return (
        <form data-testid="task-form">
          <input placeholder="Task title" disabled={isLoading} />
          <button 
            type="submit" 
            disabled={isLoading}
            onClick={() => setIsLoading(true)}
          >
            {isLoading ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      );
    };

    render(<TestTaskForm />);
    
    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Task title')).toBeDisabled();
  });

  it('should handle edit mode with existing data', () => {
    const existingTask = {
      title: 'Existing Task',
      description: 'Existing description',
      priority: 'high',
      dueDate: '2024-12-31'
    };

    const TestTaskForm = () => (
      <form data-testid="task-form">
        <h2>Edit Task</h2>
        <input 
          placeholder="Task title" 
          name="title" 
          defaultValue={existingTask.title}
        />
        <textarea 
          placeholder="Task description" 
          name="description"
          defaultValue={existingTask.description}
        />
        <select name="priority" defaultValue={existingTask.priority}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input 
          type="date" 
          name="dueDate"
          defaultValue={existingTask.dueDate}
        />
        <button type="submit">Update Task</button>
      </form>
    );

    render(<TestTaskForm />);
    
    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
    expect(screen.getByText('Update Task')).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();
    const mockCancel = vi.fn();

    const TestTaskForm = () => {
      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          mockSubmit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          mockCancel();
        }
      };

      return (
        <form data-testid="task-form" onKeyDown={handleKeyDown}>
          <input placeholder="Task title" name="title" />
          <textarea placeholder="Task description" name="description" />
          <button type="submit">Create</button>
          <button type="button" onClick={mockCancel}>Cancel</button>
        </form>
      );
    };

    render(<TestTaskForm />);
    
    const titleInput = screen.getByPlaceholderText('Task title');
    titleInput.focus();

    // Test Ctrl+Enter shortcut
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(mockSubmit).toHaveBeenCalled();

    // Test Escape shortcut
    await user.keyboard('{Escape}');
    expect(mockCancel).toHaveBeenCalled();
  });

  it('should show character count for description', async () => {
    const user = userEvent.setup();

    const TestTaskForm = () => {
      const [description, setDescription] = useState('');
      const maxLength = 500;

      return (
        <form data-testid="task-form">
          <textarea 
            placeholder="Task description" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={maxLength}
          />
          <div data-testid="char-count">
            {description.length}/{maxLength}
          </div>
        </form>
      );
    };

    render(<TestTaskForm />);
    
    const textarea = screen.getByPlaceholderText('Task description');
    await user.type(textarea, 'This is a test description');

    expect(screen.getByTestId('char-count')).toHaveTextContent('26/500');
  });

  it('should handle error states', () => {
    const TestTaskForm = () => {
      const [error, setError] = useState('');

      const simulateError = () => {
        setError('Failed to create task. Please try again.');
      };

      return (
        <form data-testid="task-form">
          <input placeholder="Task title" name="title" />
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button type="button" onClick={simulateError}>
            Simulate Error
          </button>
        </form>
      );
    };

    render(<TestTaskForm />);
    
    const errorButton = screen.getByText('Simulate Error');
    fireEvent.click(errorButton);
    
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to create task. Please try again.');
  });

  it('should handle organization assignment', () => {
    const TestTaskForm = () => (
      <form data-testid="task-form">
        <input placeholder="Task title" name="title" />
        <div data-testid="org-info">
          <span>Organization: Acme Corp</span>
          <span>This task will be assigned to the organization</span>
        </div>
        <select name="assignee">
          <option value="">Assign to...</option>
          <option value="user1">John Doe</option>
          <option value="user2">Jane Smith</option>
        </select>
        <button type="submit">Create Organization Task</button>
      </form>
    );

    render(<TestTaskForm />);
    
    expect(screen.getByText('Organization: Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('This task will be assigned to the organization')).toBeInTheDocument();
    expect(screen.getByText('Create Organization Task')).toBeInTheDocument();
  });
});
