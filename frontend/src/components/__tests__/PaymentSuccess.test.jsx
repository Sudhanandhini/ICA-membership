import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaymentSuccess from '../PaymentSuccess';

const mockPaymentData = {
  payment: {
    id: 'pay_test123',
    amount: 1200,
    method: 'Online',
    status: 'Success',
    date: '2025-06-15T10:30:00Z',
  },
  member: {
    name: 'Rajesh Kumar',
    folio_number: 'FOL001',
    email: 'rajesh@test.com',
  },
  activatedYears: [
    { start: '2025-04-01', end: '2026-03-31' },
  ],
};

describe('PaymentSuccess', () => {
  it('should render payment success heading', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
  });

  it('should render transaction ID', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('pay_test123')).toBeInTheDocument();
  });

  it('should render member name and folio', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('FOL001')).toBeInTheDocument();
  });

  it('should render member email', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('rajesh@test.com')).toBeInTheDocument();
  });

  it('should render activated membership year', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('Apr 2025 - Mar 2026')).toBeInTheDocument();
  });

  it('should render download receipt button', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('Download Receipt')).toBeInTheDocument();
  });

  it('should render back to home button', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
  });

  it('should render confirmation email notice', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText(/confirmation email/i)).toBeInTheDocument();
  });

  it('should render payment status badge', () => {
    render(<PaymentSuccess paymentData={mockPaymentData} onReset={vi.fn()} />);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
