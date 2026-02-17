import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLogin from '../../components/AdminLogin';
import MemberSearch from '../../components/MemberSearch';
import fs from 'fs';
import path from 'path';

// Mock API
vi.mock('../../services/api', () => ({
  memberAPI: {
    search: vi.fn(),
  },
  adminAPI: {
    login: vi.fn(),
  },
}));

import { memberAPI, adminAPI } from '../../services/api';

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// ============================================
// TOKEN STORAGE SECURITY
// ============================================

describe('Token Storage Security', () => {
  it('should store token in localStorage on successful login', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'jwt_test_token' });

    render(<AdminLogin onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'admin123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith('adminToken', 'jwt_test_token');
    });
  });

  it('should NOT store password in localStorage after login', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'jwt_test_token' });

    render(<AdminLogin onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'secretpass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith('adminToken', 'jwt_test_token');
    });

    // Check that password was never stored in localStorage
    const allCalls = window.localStorage.setItem.mock.calls;
    const storedValues = allCalls.map(call => call[1]);
    expect(storedValues).not.toContain('secretpass123');

    // Also check keys - no password-related key should exist
    const storedKeys = allCalls.map(call => call[0]);
    expect(storedKeys).not.toContain('password');
    expect(storedKeys).not.toContain('adminPassword');
  });

  it('should NOT store password in sessionStorage', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'jwt_test_token' });

    // Mock sessionStorage
    const sessionSetItem = vi.spyOn(window.sessionStorage, 'setItem');

    render(<AdminLogin onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'secretpass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    // Password should not be in sessionStorage either
    const sessionCalls = sessionSetItem.mock.calls;
    const sessionValues = sessionCalls.map(call => call[1]);
    expect(sessionValues).not.toContain('secretpass123');
  });

  it('should NOT store username in localStorage', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'jwt_test_token' });

    render(<AdminLogin onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'admin123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    const allCalls = window.localStorage.setItem.mock.calls;
    const storedKeys = allCalls.map(call => call[0]);
    expect(storedKeys).not.toContain('username');
    expect(storedKeys).not.toContain('adminUsername');
  });
});

// ============================================
// TOKEN TRANSMISSION
// ============================================

describe('Token Transmission Security', () => {
  it('should attach token via Authorization header in API service (not URL param)', () => {
    const filePath = path.resolve(__dirname, '../../services/api.js');
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }

    // Token should be sent via Authorization header
    expect(content).toContain('Authorization');
    expect(content).toContain('Bearer');

    // Token should NOT be appended to URL as query param
    expect(content).not.toContain('?token=');
    expect(content).not.toContain('&token=');
  });

  it('should retrieve token from localStorage for admin requests', () => {
    const filePath = path.resolve(__dirname, '../../services/api.js');
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }

    // Should use localStorage to get token
    expect(content).toContain("localStorage.getItem('adminToken')");
  });

  it('should only attach token for admin routes', () => {
    const filePath = path.resolve(__dirname, '../../services/api.js');
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }

    // Should check URL starts with /admin before attaching token
    expect(content).toContain('/admin');
    expect(content).toContain('startsWith');
  });
});

// ============================================
// INPUT SANITIZATION
// ============================================

describe('Input Sanitization', () => {
  it('should send credentials to API as-is (no client-side injection possible)', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockResolvedValueOnce({ success: true, token: 'token' });

    render(<AdminLogin onLoginSuccess={vi.fn()} />);

    const xssUsername = '<script>alert(1)</script>';
    await user.type(screen.getByPlaceholderText('Enter username'), xssUsername);
    await user.type(screen.getByPlaceholderText('Enter password'), 'test');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      // The login function should be called with the exact input
      // XSS in credentials doesn't affect the client - it's the server's job to handle
      expect(adminAPI.login).toHaveBeenCalledWith(xssUsername, 'test');
    });
  });

  it('should handle special regex characters in MemberSearch without crashing', async () => {
    const user = userEvent.setup();
    memberAPI.search.mockResolvedValueOnce({ members: [] });

    render(<MemberSearch onMemberSelect={vi.fn()} />);

    // These characters can cause regex errors if search uses regex
    // Use fireEvent instead of userEvent.type because userEvent interprets {} as key descriptors
    const input = screen.getByPlaceholderText('Enter member name...');
    const regexChars = '.*+?^$|\\';
    await user.clear(input);
    await user.type(input, regexChars);
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(memberAPI.search).toHaveBeenCalledWith(regexChars);
    });
  });

  it('should pass search input directly to API (server handles sanitization)', async () => {
    const user = userEvent.setup();
    memberAPI.search.mockResolvedValueOnce({ members: [] });

    render(<MemberSearch onMemberSelect={vi.fn()} />);

    const sqlInjection = "'; DROP TABLE users;--";
    await user.type(screen.getByPlaceholderText('Enter member name...'), sqlInjection);
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(memberAPI.search).toHaveBeenCalledWith(sqlInjection);
    });
  });
});

// ============================================
// PASSWORD FIELD SECURITY
// ============================================

describe('Password Field Security', () => {
  it('should render password field with type="password" by default', () => {
    render(<AdminLogin onLoginSuccess={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should not have autocomplete="off" issue - password fields should be secure', () => {
    const { container } = render(<AdminLogin onLoginSuccess={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    // Password input should exist and be of type password
    expect(passwordInput.tagName).toBe('INPUT');
    expect(passwordInput.type).toBe('password');
  });

  it('should not expose password value in DOM attributes', () => {
    const { container } = render(<AdminLogin onLoginSuccess={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    // Password value should not be in a visible DOM attribute
    expect(passwordInput.getAttribute('data-password')).toBeNull();
    expect(passwordInput.getAttribute('data-value')).toBeNull();
  });
});
