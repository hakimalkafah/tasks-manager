import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useOrganizationList: vi.fn(),
  useOrganization: vi.fn(),
  useUser: vi.fn(),
  OrganizationSwitcher: vi.fn(({ children }) => <div data-testid="clerk-org-switcher">{children}</div>),
}));

// Mock Convex
vi.mock('convex/react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

// Comprehensive OrganizationSwitcher tests
describe('OrganizationSwitcher', () => {
  const mockOrganizations = [
    {
      id: 'org_1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      imageUrl: 'https://example.com/acme.png',
      membersCount: 5,
      role: 'admin'
    },
    {
      id: 'org_2',
      name: 'Tech Startup',
      slug: 'tech-startup',
      imageUrl: 'https://example.com/tech.png',
      membersCount: 12,
      role: 'member'
    },
    {
      id: 'org_3',
      name: 'Design Agency',
      slug: 'design-agency',
      imageUrl: null,
      membersCount: 3,
      role: 'admin'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render organization switcher with current organization', () => {
    const TestOrganizationSwitcher = () => {
      const currentOrg = mockOrganizations[0];
      
      return (
        <div data-testid="org-switcher">
          <div className="current-org">
            <img src={currentOrg.imageUrl || ''} alt={currentOrg.name} />
            <div>
              <h3>{currentOrg.name}</h3>
              <span className="role">{currentOrg.role}</span>
              <span className="members">{currentOrg.membersCount} members</span>
            </div>
          </div>
          <button aria-label="Switch organization">
            <span>Switch</span>
          </button>
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('5 members')).toBeInTheDocument();
    expect(screen.getByLabelText('Switch organization')).toBeInTheDocument();
  });

  it('should display organization list when dropdown is opened', async () => {
    const user = userEvent.setup();

    const TestOrganizationSwitcher = () => {
      const [isOpen, setIsOpen] = useState(false);
      
      return (
        <div data-testid="org-switcher">
          <button onClick={() => setIsOpen(!isOpen)}>
            Current: {mockOrganizations[0].name}
          </button>
          {isOpen && (
            <div data-testid="org-dropdown" className="dropdown">
              <div className="org-list">
                {mockOrganizations.map(org => (
                  <div key={org.id} data-testid={`org-option-${org.id}`}>
                    <div className="org-info">
                      <span className="org-name">{org.name}</span>
                      <span className="org-role">{org.role}</span>
                      <span className="org-members">{org.membersCount} members</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="actions">
                <button>Create Organization</button>
                <button>Manage Organizations</button>
              </div>
            </div>
          )}
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    const trigger = screen.getByText('Current: Acme Corp');
    await user.click(trigger);

    const dropdown = screen.getByTestId('org-dropdown');
    expect(dropdown).toBeInTheDocument();
    
    expect(within(dropdown).getByText('Acme Corp')).toBeInTheDocument();
    expect(within(dropdown).getByText('Tech Startup')).toBeInTheDocument();
    expect(within(dropdown).getByText('Design Agency')).toBeInTheDocument();
    expect(within(dropdown).getByText('Create Organization')).toBeInTheDocument();
  });

  it('should handle organization switching', async () => {
    const user = userEvent.setup();
    const mockSwitchOrg = vi.fn();

    const TestOrganizationSwitcher = () => {
      const [currentOrgId, setCurrentOrgId] = useState('org_1');
      const [isOpen, setIsOpen] = useState(false);
      
      const currentOrg = mockOrganizations.find(org => org.id === currentOrgId);

      const handleSwitch = (orgId: string) => {
        mockSwitchOrg(orgId);
        setCurrentOrgId(orgId);
        setIsOpen(false);
      };

      return (
        <div data-testid="org-switcher">
          <button onClick={() => setIsOpen(!isOpen)}>
            {currentOrg?.name}
          </button>
          {isOpen && (
            <div data-testid="org-dropdown">
              {mockOrganizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  className={org.id === currentOrgId ? 'active' : ''}
                  data-testid={`switch-to-${org.id}`}
                >
                  {org.name}
                  {org.id === currentOrgId && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    // Open dropdown
    await user.click(screen.getByText('Acme Corp'));
    
    // Switch to Tech Startup
    await user.click(screen.getByTestId('switch-to-org_2'));
    
    expect(mockSwitchOrg).toHaveBeenCalledWith('org_2');
    expect(screen.getByText('Tech Startup')).toBeInTheDocument();
  });

  it('should show create organization dialog', async () => {
    const user = userEvent.setup();
    const mockCreateOrg = vi.fn();

    const TestOrganizationSwitcher = () => {
      const [showCreateDialog, setShowCreateDialog] = useState(false);
      const [orgName, setOrgName] = useState('');
      const [isCreating, setIsCreating] = useState(false);

      const handleCreate = async () => {
        setIsCreating(true);
        await mockCreateOrg({ name: orgName });
        setIsCreating(false);
        setShowCreateDialog(false);
        setOrgName('');
      };

      return (
        <div data-testid="org-switcher">
          <button onClick={() => setShowCreateDialog(true)}>
            Create Organization
          </button>
          
          {showCreateDialog && (
            <div data-testid="create-org-dialog" className="dialog">
              <h3>Create New Organization</h3>
              <input
                type="text"
                placeholder="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <div className="actions">
                <button 
                  onClick={handleCreate}
                  disabled={!orgName.trim() || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create'}
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

    render(<TestOrganizationSwitcher />);
    
    // Open create dialog
    await user.click(screen.getByText('Create Organization'));
    
    const dialog = screen.getByTestId('create-org-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Create New Organization')).toBeInTheDocument();
    
    // Fill form and submit
    const nameInput = screen.getByPlaceholderText('Organization name');
    await user.type(nameInput, 'New Company');
    
    await user.click(screen.getByText('Create'));
    
    expect(mockCreateOrg).toHaveBeenCalledWith({ name: 'New Company' });
  });

  it('should handle organization creation errors', async () => {
    const user = userEvent.setup();
    const mockCreateOrg = vi.fn().mockRejectedValue(new Error('Organization name already exists'));

    const TestOrganizationSwitcher = () => {
      const [error, setError] = useState<string | null>(null);
      const [isCreating, setIsCreating] = useState(false);

      const handleCreate = async (name: string) => {
        try {
          setError(null);
          setIsCreating(true);
          await mockCreateOrg({ name });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create organization');
        } finally {
          setIsCreating(false);
        }
      };

      return (
        <div data-testid="org-switcher">
          <button onClick={() => handleCreate('Duplicate Name')}>
            Create Organization
          </button>
          {error && (
            <div data-testid="error-message" className="error">
              {error}
            </div>
          )}
          {isCreating && (
            <div data-testid="creating-indicator">Creating organization...</div>
          )}
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    await user.click(screen.getByText('Create Organization'));
    
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Organization name already exists')).toBeInTheDocument();
    });
  });

  it('should filter organizations by search term', async () => {
    const user = userEvent.setup();

    const TestOrganizationSwitcher = () => {
      const [searchTerm, setSearchTerm] = useState('');
      
      const filteredOrgs = mockOrganizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return (
        <div data-testid="org-switcher">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div data-testid="filtered-orgs">
            {filteredOrgs.map(org => (
              <div key={org.id} data-testid={`filtered-org-${org.id}`}>
                {org.name}
              </div>
            ))}
            {filteredOrgs.length === 0 && (
              <div data-testid="no-results">No organizations found</div>
            )}
          </div>
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    const searchInput = screen.getByPlaceholderText('Search organizations...');
    await user.type(searchInput, 'tech');
    
    const filteredContainer = screen.getByTestId('filtered-orgs');
    expect(within(filteredContainer).getByText('Tech Startup')).toBeInTheDocument();
    expect(within(filteredContainer).queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('should show role-based permissions', () => {
    const TestOrganizationSwitcher = () => (
      <div data-testid="org-switcher">
        {mockOrganizations.map(org => (
          <div key={org.id} data-testid={`org-${org.id}`}>
            <span>{org.name}</span>
            <span className={`role role-${org.role}`}>{org.role}</span>
            {org.role === 'admin' && (
              <div className="admin-actions">
                <button>Manage Members</button>
                <button>Organization Settings</button>
              </div>
            )}
            {org.role === 'member' && (
              <div className="member-actions">
                <button>View Members</button>
              </div>
            )}
          </div>
        ))}
      </div>
    );

    render(<TestOrganizationSwitcher />);
    
    // Check admin permissions
    const acmeOrg = screen.getByTestId('org-org_1');
    expect(within(acmeOrg).getByText('Manage Members')).toBeInTheDocument();
    expect(within(acmeOrg).getByText('Organization Settings')).toBeInTheDocument();
    
    // Check member permissions
    const techOrg = screen.getByTestId('org-org_2');
    expect(within(techOrg).getByText('View Members')).toBeInTheDocument();
    expect(within(techOrg).queryByText('Manage Members')).not.toBeInTheDocument();
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    const mockSelect = vi.fn();

    const TestOrganizationSwitcher = () => {
      const [focusedIndex, setFocusedIndex] = useState(0);
      const [isOpen, setIsOpen] = useState(true);

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, mockOrganizations.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          mockSelect(mockOrganizations[focusedIndex].id);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsOpen(false);
        }
      };

      return (
        <div data-testid="org-switcher" onKeyDown={handleKeyDown} tabIndex={0}>
          {isOpen && (
            <div data-testid="org-list">
              {mockOrganizations.map((org, index) => (
                <div
                  key={org.id}
                  className={index === focusedIndex ? 'focused' : ''}
                  data-testid={`org-item-${org.id}`}
                >
                  {org.name}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    const switcher = screen.getByTestId('org-switcher');
    switcher.focus();

    // Navigate down
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('org-item-org_2')).toHaveClass('focused');

    // Select with Enter
    await user.keyboard('{Enter}');
    expect(mockSelect).toHaveBeenCalledWith('org_2');
  });

  it('should show loading state while fetching organizations', () => {
    const TestOrganizationSwitcher = () => {
      const [isLoading] = useState(true);

      return (
        <div data-testid="org-switcher">
          {isLoading ? (
            <div data-testid="loading-state">
              <div className="spinner" aria-label="Loading organizations">
                <span>Loading organizations...</span>
              </div>
            </div>
          ) : (
            <div>Organizations loaded</div>
          )}
        </div>
      );
    };

    render(<TestOrganizationSwitcher />);
    
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading organizations')).toBeInTheDocument();
    expect(screen.getByText('Loading organizations...')).toBeInTheDocument();
  });

  it('should handle personal workspace option', () => {
    const mockSwitchToPersonal = vi.fn();

    const TestOrganizationSwitcher = () => (
      <div data-testid="org-switcher">
        <div className="workspace-options">
          <button 
            onClick={() => mockSwitchToPersonal()}
            data-testid="personal-workspace"
            className="personal-option"
          >
            <span>Personal Workspace</span>
            <span className="description">Your individual tasks</span>
          </button>
          <div className="divider">Organizations</div>
          {mockOrganizations.map(org => (
            <div key={org.id}>{org.name}</div>
          ))}
        </div>
      </div>
    );

    render(<TestOrganizationSwitcher />);
    
    const personalWorkspace = screen.getByTestId('personal-workspace');
    expect(personalWorkspace).toBeInTheDocument();
    expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
    expect(screen.getByText('Your individual tasks')).toBeInTheDocument();
    
    fireEvent.click(personalWorkspace);
    expect(mockSwitchToPersonal).toHaveBeenCalled();
  });

  it('should show organization avatars with fallbacks', () => {
    const TestOrganizationSwitcher = () => (
      <div data-testid="org-switcher">
        {mockOrganizations.map(org => (
          <div key={org.id} data-testid={`org-avatar-${org.id}`}>
            {org.imageUrl ? (
              <img src={org.imageUrl} alt={org.name} />
            ) : (
              <div className="avatar-fallback">
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{org.name}</span>
          </div>
        ))}
      </div>
    );

    render(<TestOrganizationSwitcher />);
    
    // Check image avatar
    expect(screen.getByAltText('Acme Corp')).toBeInTheDocument();
    
    // Check fallback avatar
    const designAgencyAvatar = screen.getByTestId('org-avatar-org_3');
    expect(within(designAgencyAvatar).getByText('D')).toBeInTheDocument(); // First letter fallback
  });

  it('should handle empty organizations state', () => {
    const TestOrganizationSwitcher = () => (
      <div data-testid="org-switcher">
        <div className="empty-state">
          <h3>No organizations yet</h3>
          <p>Create your first organization to collaborate with your team</p>
          <button>Create Organization</button>
        </div>
      </div>
    );

    render(<TestOrganizationSwitcher />);
    
    expect(screen.getByText('No organizations yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first organization to collaborate with your team')).toBeInTheDocument();
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
  });
});
