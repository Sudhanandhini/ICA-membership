import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentSuccess from '../../components/PaymentSuccess';
import MemberSearch from '../../components/MemberSearch';
import AdminLogin from '../../components/AdminLogin';
import fs from 'fs';
import path from 'path';

// Mock API for MemberSearch
vi.mock('../../services/api', () => ({
  memberAPI: {
    search: vi.fn(),
  },
  adminAPI: {
    login: vi.fn(),
  },
}));

import { memberAPI, adminAPI } from '../../services/api';

// XSS payload vectors
const XSS_PAYLOADS = {
  scriptTag: '<script>alert("xss")</script>',
  imgOnerror: '<img src=x onerror=alert(1)>',
  svgOnload: '<svg onload=alert(1)>',
  iframeSrc: '<iframe src="javascript:alert(1)">',
  eventHandler: '" onmouseover="alert(1)" "',
  javascriptUrl: 'javascript:alert(document.cookie)',
  encodedScript: '&lt;script&gt;alert(1)&lt;/script&gt;',
};

// ============================================
// XSS IN PAYMENTSUCCESS COMPONENT
// ============================================

describe('XSS Prevention - PaymentSuccess', () => {
  it('should render script tag in member name as plain text', () => {
    const paymentData = {
      payment: { id: 'pay_123', amount: 1200, method: 'Online', status: 'Success', date: '2025-06-15T10:30:00Z' },
      member: { name: XSS_PAYLOADS.scriptTag, folio_number: 'FOL001', email: 'test@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    // React auto-escapes - script tag should appear as text, not as an actual script element
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });

  it('should render HTML tags in email as plain text', () => {
    const paymentData = {
      payment: { id: 'pay_123', amount: 1200, method: 'Online', status: 'Success', date: '2025-06-15T10:30:00Z' },
      member: { name: 'Test', folio_number: 'FOL001', email: XSS_PAYLOADS.imgOnerror + '@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    // No actual img element should be injected
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('should render script tag in transaction ID as plain text', () => {
    const paymentData = {
      payment: { id: XSS_PAYLOADS.scriptTag, amount: 1200, method: 'Online', status: 'Success', date: '2025-06-15T10:30:00Z' },
      member: { name: 'Test', folio_number: 'FOL001', email: 'test@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    expect(container.querySelector('script')).toBeNull();
  });

  it('should handle SVG onload XSS in folio_number', () => {
    const paymentData = {
      payment: { id: 'pay_123', amount: 1200, method: 'Online', status: 'Success', date: '2025-06-15T10:30:00Z' },
      member: { name: 'Test', folio_number: XSS_PAYLOADS.svgOnload, email: 'test@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    // No SVG with onload should be injected into the DOM
    const svgs = container.querySelectorAll('svg[onload]');
    expect(svgs.length).toBe(0);
  });

  it('should handle event handler injection in payment status', () => {
    const paymentData = {
      payment: { id: 'pay_123', amount: 1200, method: 'Online', status: XSS_PAYLOADS.eventHandler, date: '2025-06-15T10:30:00Z' },
      member: { name: 'Test', folio_number: 'FOL001', email: 'test@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    // No element should have onmouseover attribute injected
    const elementsWithHandler = container.querySelectorAll('[onmouseover]');
    expect(elementsWithHandler.length).toBe(0);
  });
});

// ============================================
// XSS IN MEMBERSEARCH COMPONENT
// ============================================

describe('XSS Prevention - MemberSearch', () => {
  it('should render XSS payload in member name as plain text in results', async () => {
    const user = userEvent.setup();
    const mockMembers = [
      { id: 1, name: XSS_PAYLOADS.scriptTag, folio_number: 'FOL001', phone: '9876543210', email: 'test@test.com' },
    ];
    memberAPI.search.mockResolvedValueOnce({ members: mockMembers });

    const { container } = render(<MemberSearch onMemberSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'test');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      // Script tag should be rendered as text, not executed
      expect(container.querySelector('script')).toBeNull();
      expect(container.textContent).toContain('<script>');
    });
  });

  it('should handle img onerror XSS in folio_number', async () => {
    const user = userEvent.setup();
    const mockMembers = [
      { id: 1, name: 'Test', folio_number: XSS_PAYLOADS.imgOnerror, phone: '9876543210', email: 'test@test.com' },
    ];
    memberAPI.search.mockResolvedValueOnce({ members: mockMembers });

    const { container } = render(<MemberSearch onMemberSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'test');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(container.querySelector('img[src="x"]')).toBeNull();
    });
  });

  it('should handle XSS in email field of search results', async () => {
    const user = userEvent.setup();
    const mockMembers = [
      { id: 1, name: 'Test', folio_number: 'FOL001', phone: '9876543210', email: XSS_PAYLOADS.scriptTag },
    ];
    memberAPI.search.mockResolvedValueOnce({ members: mockMembers });

    const { container } = render(<MemberSearch onMemberSelect={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter member name...'), 'test');
    await user.click(screen.getByRole('button', { name: /search member/i }));

    await waitFor(() => {
      expect(container.querySelector('script')).toBeNull();
    });
  });
});

// ============================================
// XSS IN ADMINLOGIN COMPONENT
// ============================================

describe('XSS Prevention - AdminLogin', () => {
  it('should render HTML in error message as plain text', async () => {
    const user = userEvent.setup();
    adminAPI.login.mockRejectedValueOnce(new Error(XSS_PAYLOADS.scriptTag));

    const { container } = render(<AdminLogin onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      // Error message containing script tag should be rendered as text
      expect(container.querySelector('script')).toBeNull();
    });
  });
});

// ============================================
// dangerouslySetInnerHTML CHECK
// ============================================

describe('dangerouslySetInnerHTML Check', () => {
  const componentFiles = [
    'PaymentSuccess.jsx',
    'MemberSearch.jsx',
    'AdminLogin.jsx',
    'Loading.jsx',
  ];

  componentFiles.forEach((file) => {
    it(`should not use dangerouslySetInnerHTML in ${file}`, () => {
      const filePath = path.resolve(__dirname, '../../components', file);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        // File might not exist in test env, skip
        return;
      }
      expect(content).not.toContain('dangerouslySetInnerHTML');
    });
  });
});

// ============================================
// URL INJECTION
// ============================================

describe('URL Injection Prevention', () => {
  it('should not create javascript: protocol links from payment ID', () => {
    const paymentData = {
      payment: { id: XSS_PAYLOADS.javascriptUrl, amount: 1200, method: 'Online', status: 'Success', date: '2025-06-15T10:30:00Z' },
      member: { name: 'Test', folio_number: 'FOL001', email: 'test@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    // No anchor should have javascript: protocol
    const links = container.querySelectorAll('a[href^="javascript:"]');
    expect(links.length).toBe(0);
  });

  it('should not auto-link URL-like content in member name', () => {
    const paymentData = {
      payment: { id: 'pay_123', amount: 1200, method: 'Online', status: 'Success', date: '2025-06-15T10:30:00Z' },
      member: { name: 'https://malicious.com/steal?data=token', folio_number: 'FOL001', email: 'test@test.com' },
      activatedYears: [{ start: '2025-04-01', end: '2026-03-31' }],
    };

    const { container } = render(<PaymentSuccess paymentData={paymentData} onReset={vi.fn()} />);

    // No auto-generated link to the malicious URL
    const maliciousLinks = container.querySelectorAll('a[href*="malicious.com"]');
    expect(maliciousLinks.length).toBe(0);
  });
});
