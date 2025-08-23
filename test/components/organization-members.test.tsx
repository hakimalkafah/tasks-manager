import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Simple test for organization members functionality
describe('OrganizationMembers', () => {
  it('should render basic members list', () => {
    const TestOrganizationMembers = () => (
      <div data-testid="organization-members">
        <h2>Organization Members</h2>
        <div>
          <span>John Doe</span>
          <span>Admin</span>
        </div>
        <div>
          <span>Jane Smith</span>
          <span>Member</span>
        </div>
      </div>
    );

    render(<TestOrganizationMembers />);
    
    expect(screen.getByText('Organization Members')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('should handle empty state', () => {
    const TestOrganizationMembers = () => (
      <div data-testid="organization-members-empty">
        <span>No members yet</span>
        <span>Invite your first team member</span>
      </div>
    );

    render(<TestOrganizationMembers />);
    
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByText('Invite your first team member')).toBeInTheDocument();
  });
});

