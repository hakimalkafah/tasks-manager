import { test, expect } from '@playwright/test';

test.describe('Organization Workflows E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Clerk authentication
    await page.route('**/api/auth/**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ 
          user: { 
            id: 'test-user', 
            name: 'Test User',
            organizationMemberships: [
              { organization: { id: 'org1', name: 'Test Org', slug: 'test-org' } }
            ]
          } 
        }),
      });
    });

    // Mock Convex API calls
    await page.route('**/convex/**', (route) => {
      const url = route.request().url();
      
      if (url.includes('getOrganizations')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              _id: 'org1',
              name: 'Test Organization',
              slug: 'test-org',
              clerkOrgId: 'clerk-org-1',
              createdBy: 'test-user',
            },
          ]),
        });
      } else if (url.includes('getOrganizationMembers')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              _id: 'member1',
              userId: 'test-user',
              role: 'admin',
              user: { name: 'Test User', email: 'test@example.com' },
            },
            {
              _id: 'member2',
              userId: 'user2',
              role: 'member',
              user: { name: 'John Doe', email: 'john@example.com' },
            },
          ]),
        });
      } else if (url.includes('getOrganizationTasks')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              _id: 'task1',
              title: 'Team Task',
              description: 'Collaborative task',
              completed: false,
              priority: 'high',
              organizationId: 'org1',
            },
          ]),
        });
      } else {
        route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto('/');
  });

  test('should display organization switcher', async ({ page }) => {
    await expect(page.getByText('Test Organization')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch organization' })).toBeVisible();
  });

  test('should navigate to organization dashboard', async ({ page }) => {
    // Click on organization
    await page.getByText('Test Organization').click();

    // Should navigate to organization page
    await expect(page).toHaveURL('/organization/test-org');
    await expect(page.getByText('Organization Dashboard')).toBeVisible();
  });

  test('should create new organization', async ({ page }) => {
    // Click create organization button
    await page.getByRole('button', { name: 'Create Organization' }).click();

    // Fill organization form
    await page.getByPlaceholder('Organization name').fill('New Test Org');
    await page.getByPlaceholder('Organization slug').fill('new-test-org');

    // Submit form
    await page.getByRole('button', { name: 'Create' }).click();

    // Should navigate to new organization
    await expect(page).toHaveURL('/organization/new-test-org');
  });

  test('should manage organization members', async ({ page }) => {
    // Navigate to organization
    await page.goto('/organization/test-org/settings');

    // Should show members list
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('admin')).toBeVisible();
    await expect(page.getByText('member')).toBeVisible();
  });

  test('should invite new member', async ({ page }) => {
    await page.goto('/organization/test-org/settings');

    // Click invite member button
    await page.getByRole('button', { name: 'Invite Member' }).click();

    // Fill invitation form
    await page.getByPlaceholder('Email address').fill('newuser@example.com');
    await page.getByRole('combobox', { name: 'Role' }).click();
    await page.getByText('member').click();

    // Send invitation
    await page.getByRole('button', { name: 'Send Invitation' }).click();

    // Should show success message
    await expect(page.getByText('Invitation sent successfully')).toBeVisible();
  });

  test('should update member role', async ({ page }) => {
    await page.goto('/organization/test-org/settings');

    // Find member row and click role dropdown
    const memberRow = page.getByText('John Doe').locator('..');
    await memberRow.getByRole('combobox', { name: 'Role' }).click();
    await page.getByText('admin').click();

    // Confirm role change
    await page.getByRole('button', { name: 'Update Role' }).click();

    // Should show updated role
    await expect(memberRow.getByText('admin')).toBeVisible();
  });

  test('should remove member', async ({ page }) => {
    await page.goto('/organization/test-org/settings');

    // Click remove button for member
    const memberRow = page.getByText('John Doe').locator('..');
    await memberRow.getByRole('button', { name: 'Remove' }).click();

    // Confirm removal
    await page.getByRole('button', { name: 'Confirm Remove' }).click();

    // Member should be removed
    await expect(page.getByText('John Doe')).not.toBeVisible();
  });

  test('should manage organization tasks', async ({ page }) => {
    await page.goto('/organization/test-org/tasks');

    // Should show organization tasks
    await expect(page.getByText('Team Task')).toBeVisible();
    await expect(page.getByText('Collaborative task')).toBeVisible();
  });

  test('should create organization task', async ({ page }) => {
    await page.goto('/organization/test-org/tasks');

    // Click create task button
    await page.getByRole('button', { name: 'Create Task' }).click();

    // Fill task form
    await page.getByPlaceholder('Task title').fill('New Team Task');
    await page.getByPlaceholder('Task description').fill('Task for the team');
    
    // Assign to member
    await page.getByRole('combobox', { name: 'Assign to' }).click();
    await page.getByText('John Doe').click();

    // Submit form
    await page.getByRole('button', { name: 'Create' }).click();

    // Task should appear in list
    await expect(page.getByText('New Team Task')).toBeVisible();
  });

  test('should switch between organizations', async ({ page }) => {
    // Mock multiple organizations
    await page.route('**/convex/**', (route) => {
      if (route.request().url().includes('getOrganizations')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              _id: 'org1',
              name: 'Test Organization',
              slug: 'test-org',
            },
            {
              _id: 'org2',
              name: 'Another Org',
              slug: 'another-org',
            },
          ]),
        });
      } else {
        route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.reload();

    // Click organization switcher
    await page.getByRole('button', { name: 'Switch organization' }).click();

    // Select different organization
    await page.getByText('Another Org').click();

    // Should navigate to new organization
    await expect(page).toHaveURL('/organization/another-org');
  });

  test('should handle organization permissions', async ({ page }) => {
    // Mock as member (not admin)
    await page.route('**/convex/**', (route) => {
      if (route.request().url().includes('getOrganizationMembers')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            {
              _id: 'member1',
              userId: 'test-user',
              role: 'member',
              user: { name: 'Test User', email: 'test@example.com' },
            },
          ]),
        });
      } else {
        route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.goto('/organization/test-org/settings');

    // Member should not see admin controls
    await expect(page.getByRole('button', { name: 'Invite Member' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).not.toBeVisible();
  });

  test('should show organization calendar', async ({ page }) => {
    await page.goto('/organization/test-org');

    // Click calendar tab
    await page.getByRole('tab', { name: 'Calendar' }).click();

    // Should show calendar view
    await expect(page.getByTestId('calendar')).toBeVisible();
  });

  test('should create organization event', async ({ page }) => {
    await page.goto('/organization/test-org');
    await page.getByRole('tab', { name: 'Calendar' }).click();

    // Click on calendar slot to create event
    await page.getByTestId('calendar-slot').click();

    // Fill event form
    await page.getByPlaceholder('Event title').fill('Team Meeting');
    await page.getByPlaceholder('Event description').fill('Weekly sync meeting');

    // Create event
    await page.getByRole('button', { name: 'Create Event' }).click();

    // Event should appear on calendar
    await expect(page.getByText('Team Meeting')).toBeVisible();
  });

  test('should handle organization not found', async ({ page }) => {
    await page.goto('/organization/nonexistent-org');

    // Should show 404 or redirect
    await expect(page.getByText('Organization not found')).toBeVisible();
  });

  test('should leave organization', async ({ page }) => {
    await page.goto('/organization/test-org/settings');

    // Click leave organization button
    await page.getByRole('button', { name: 'Leave Organization' }).click();

    // Confirm leaving
    await page.getByRole('button', { name: 'Confirm Leave' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('You have left the organization')).toBeVisible();
  });
});
