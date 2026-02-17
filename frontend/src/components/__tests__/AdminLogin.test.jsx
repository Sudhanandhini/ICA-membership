import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLogin from '../AdminLogin';

// Mock the API module
vi.mock('../../services/api', () => ({
  adminAPI: {
    login: vi.fn(),
  },
}));

import { adminAPI } from '../../services/api';

describe('AdminLogin', () => {
  const mockOnLoginSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('should render username and password fields', () => {
    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
  });

  it('should render login button', () => {
    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should render Admin Login heading', () => {
    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);
    expect(screen.getByText('Admin Login')).toBeInTheDocument();
  });

  it('should show error for empty fields on submit', async () => {
    const user = userEvent.setup();
    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByText('Please enter both username and password')).toBeInTheDocument();
    expect(adminAPI.login).not.toHaveBeenCalled();
  });

  it('should call login API with credentials on submit', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'test_token' });

    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'admin123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(adminAPI.login).toHaveBeenCalledWith('admin', 'admin123');
    });
  });

  it('should call onLoginSuccess on successful login', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'test_token' });

    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'admin123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalled();
    });
  });

  it('should store token in localStorage on success', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'jwt_test_token' });

    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'admin123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith('adminToken', 'jwt_test_token');
    });
  });

  it('should show error message on failed login', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockRejectedValueOnce(new Error('Invalid username or password'));

    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
  });

  it('should toggle password visibility', async () => {
    const user = userEvent.setup();
    render(<AdminLogin onLoginSuccess={mockOnLoginSuccess} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the toggle button (it's a button within the password field group)
    const toggleButtons = screen.getAllByRole('button');
    const toggleBtn = toggleButtons.find(btn => btn.type === 'button');
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
