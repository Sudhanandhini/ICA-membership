import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn(function (key) { return this.store[key] || null; }),
  setItem: vi.fn(function (key, value) { this.store[key] = value; }),
  removeItem: vi.fn(function (key) { delete this.store[key]; }),
  clear: vi.fn(function () { this.store = {}; }),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.Razorpay
window.Razorpay = vi.fn(() => ({
  open: vi.fn(),
  on: vi.fn(),
}));
