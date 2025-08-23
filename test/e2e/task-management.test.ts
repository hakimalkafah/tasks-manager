import { test, expect } from '@playwright/test';

test.describe('Task Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { id: 'test-user', name: 'Test User' } }),
      });
    });

    // Mock Convex API calls
    await page.route('**/convex/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('getTasks')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              _id: 'task1',
              title: 'Complete project',
              description: 'Finish the task management app',
              completed: false,
              priority: 'high',
              userId: 'test-user',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]),
        });
      } else if (url.includes('createTask')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify('new-task-id'),
        });
      } else {
        route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto('/dashboard');
  });

  test('should display existing tasks', async ({ page }) => {
    await expect(page.getByText('Complete project')).toBeVisible();
    await expect(page.getByText('Finish the task management app')).toBeVisible();
    await expect(page.getByText('High')).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    // Click create task button
    await page.getByRole('button', { name: 'Create Task' }).click();

    // Fill task form
    await page.getByPlaceholder('Task title').fill('New Test Task');
    await page.getByPlaceholder('Task description').fill('This is a test task');
    
    // Select priority
    await page.getByRole('combobox', { name: 'Priority' }).click();
    await page.getByText('Medium').click();

    // Submit form
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify task appears in list
    await expect(page.getByText('New Test Task')).toBeVisible();
  });

  test('should edit an existing task', async ({ page }) => {
    // Click on task to edit
    await page.getByText('Complete project').click();

    // Edit task title
    const titleInput = page.getByDisplayValue('Complete project');
    await titleInput.clear();
    await titleInput.fill('Updated project task');

    // Save changes
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify changes
    await expect(page.getByText('Updated project task')).toBeVisible();
  });

  test('should mark task as completed', async ({ page }) => {
    // Find and click checkbox
    await page.getByRole('checkbox', { name: 'Mark as completed' }).click();

    // Verify task is marked as completed
    await expect(page.getByRole('checkbox', { name: 'Mark as completed' })).toBeChecked();
    await expect(page.getByText('Complete project')).toHaveClass(/line-through/);
  });

  test('should delete a task', async ({ page }) => {
    // Click on task options
    await page.getByRole('button', { name: 'Task options' }).click();
    
    // Click delete
    await page.getByText('Delete').click();
    
    // Confirm deletion
    await page.getByRole('button', { name: 'Confirm Delete' }).click();

    // Verify task is removed
    await expect(page.getByText('Complete project')).not.toBeVisible();
  });

  test('should filter tasks by priority', async ({ page }) => {
    // Open filter dropdown
    await page.getByRole('button', { name: 'Filter' }).click();
    
    // Select high priority filter
    await page.getByText('High Priority').click();

    // Verify only high priority tasks are shown
    await expect(page.getByText('Complete project')).toBeVisible();
    
    // Add a low priority task to test filter
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.getByPlaceholder('Task title').fill('Low Priority Task');
    await page.getByRole('combobox', { name: 'Priority' }).click();
    await page.getByText('Low').click();
    await page.getByRole('button', { name: 'Create' }).click();

    // Low priority task should not be visible with filter active
    await expect(page.getByText('Low Priority Task')).not.toBeVisible();
  });

  test('should search tasks', async ({ page }) => {
    // Use search input
    await page.getByPlaceholder('Search tasks...').fill('project');

    // Verify filtered results
    await expect(page.getByText('Complete project')).toBeVisible();
    
    // Search for non-existent task
    await page.getByPlaceholder('Search tasks...').clear();
    await page.getByPlaceholder('Search tasks...').fill('nonexistent');
    
    await expect(page.getByText('No tasks found')).toBeVisible();
  });

  test('should handle task due dates', async ({ page }) => {
    // Create task with due date
    await page.getByRole('button', { name: 'Create Task' }).click();
    await page.getByPlaceholder('Task title').fill('Task with due date');
    
    // Set due date
    await page.getByLabel('Due date').click();
    await page.getByText('15').click(); // Select 15th of current month
    
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify due date is displayed
    await expect(page.getByText('Due:')).toBeVisible();
  });

  test('should show task statistics', async ({ page }) => {
    // Verify task counters
    await expect(page.getByText('1 Total')).toBeVisible();
    await expect(page.getByText('1 Pending')).toBeVisible();
    await expect(page.getByText('0 Completed')).toBeVisible();
  });

  test('should handle empty state', async ({ page }) => {
    // Mock empty tasks response
    await page.route('**/convex/**', (route) => {
      if (route.request().url().includes('getTasks')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([]),
        });
      } else {
        route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.reload();

    // Verify empty state
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(page.getByText('Create your first task to get started')).toBeVisible();
  });
});
