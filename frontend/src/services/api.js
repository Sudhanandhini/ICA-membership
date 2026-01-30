import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject(new Error(errorMessage));
  }
);

// Member APIs
export const memberAPI = {
  search: (name) => api.post('/members/search', { name }),
  getById: (id) => api.get(`/members/${id}`),
  getByFolio: (folioNumber) => api.get(`/members/folio/${folioNumber}`),
  create: (data) => api.post('/members/create', data),
};

// Payment APIs
export const paymentAPI = {
  getHistory: (memberId) => api.get(`/payments/history/${memberId}`),
  calculate: (memberId) => api.post('/payments/calculate', { memberId }),
  initiate: (data) => api.post('/payments/initiate', data),
  verify: (data) => api.post('/payments/verify', data),
  getStatus: (memberId) => api.get(`/payments/status/${memberId}`),
};

// Razorpay payment handler
export const handleRazorpayPayment = (orderData, onSuccess, onError) => {
  const options = {
    key: orderData.razorpayKeyId,
    amount: orderData.order.amount,
    currency: orderData.order.currency,
    name: 'Membership Payment System',
    description: 'Membership Fee Payment',
    order_id: orderData.order.id,
    prefill: {
      name: orderData.member.name,
      email: orderData.member.email,
    },
    theme: {
      color: '#0284c7',
    },
    handler: function (response) {
      onSuccess(response);
    },
    modal: {
      ondismiss: function () {
        onError(new Error('Payment cancelled by user'));
      },
    },
  };

  const razorpay = new window.Razorpay(options);
  razorpay.on('payment.failed', function (response) {
    onError(new Error(response.error.description));
  });
  razorpay.open();
};

export default api;
