import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberSearch from '../MemberSearch';

vi.mock('../../services/api', () => ({
  memberAPI: {
    search: vi.fn(),
  },
}));

import { memberAPI } from '../../services/api';

describe('MemberSearch', () => {
  const mockOnMemberSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input and button', () => {
    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    expect(screen.getByPlaceholderText('Enter member name...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search member/i })).toBeInTheDocument();
  });

  it('should disable button when input has fewer than 2 characters', () => {
    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    const button = screen.getByRole('button', { name: /search member/i });
    expect(button).toBeDisabled();
  });

  it('should enable button when input has 2+ characters', async () => {
    const user = userEvent.setup();
    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'Ra');

    const button = screen.getByRole('button', { name: /search member/i });
    expect(button).not.toBeDisabled();
  });

  it('should show error for less than 2 characters on submit', async () => {
    const user = userEvent.setup();
    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    const input = screen.getByPlaceholderText('Enter member name...');
    await user.type(input, 'R');

    // Force form submit
    const form = input.closest('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText('Please enter at least 2 characters')).toBeInTheDocument();
    });
  });

  it('should display search results after successful search', async () => {
    const user = userEvent.setup();
    const mockMembers = [
      { id: 1, name: 'Rajesh Kumar', folio_number: 'FOL001', phone: '9876543210', email: 'rajesh@test.com' },
      { id: 2, name: 'Rakesh Sharma', folio_number: 'FOL002', phone: '9876543211', email: 'rakesh@test.com' },
    ];
    memberAPI.search.mockResolvedValueOnce({ members: mockMembers });

    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'Ra');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Rakesh Sharma')).toBeInTheDocument();
    });
  });

  it('should show "No members found" for empty results', async () => {
    const user = userEvent.setup();
    memberAPI.search.mockResolvedValueOnce({ members: [] });

    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'Zzz');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(screen.getByText('No members found matching your search')).toBeInTheDocument();
    });
  });

  it('should call onMemberSelect when a result is clicked', async () => {
    const user = userEvent.setup();
    const mockMember = { id: 1, name: 'Rajesh Kumar', folio_number: 'FOL001', phone: '9876543210', email: 'rajesh@test.com' };
    memberAPI.search.mockResolvedValueOnce({ members: [mockMember] });

    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'Rajesh');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Rajesh Kumar'));
    expect(mockOnMemberSelect).toHaveBeenCalledWith(mockMember);
  });

  it('should show error message on API failure', async () => {
    const user = userEvent.setup();
    memberAPI.search.mockRejectedValueOnce(new Error('Network error'));

    render(<MemberSearch onMemberSelect={mockOnMemberSelect} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'Test');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
