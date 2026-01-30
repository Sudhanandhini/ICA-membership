import React, { useState, useEffect } from 'react';
import { X, Calendar, CreditCard, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const PaymentHistoryModal = ({ member, onClose }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    if (member) {
      fetchPaymentHistory();
    }
  }, [member]);

  const fetchPaymentHistory = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`${API_URL}/payments/history/${member.id}`);
      setPayments(response.data.payments || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch payment history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatMembershipYear = (startDate, endDate) => {
    if (!startDate || !endDate) return 'N/A';
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getFullYear()}-${end.getFullYear().toString().slice(-2)}`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    };

    const icons = {
      success: CheckCircle,
      pending: Calendar,
      failed: XCircle
    };

    const Icon = icons[status] || Calendar;
    const style = styles[status] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full ${style}`}>
        <Icon className="w-3 h-3" />
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </span>
    );
  };

  const getTotalPaid = () => {
    return payments
      .filter(p => p.payment_status === 'success')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Payment History</h3>
            <p className="text-sm text-gray-600 mt-1">
              {member.name} ({member.folio_number})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No payment history found</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-600 mb-1">Total Payments</p>
                  <p className="text-2xl font-bold text-blue-900">{payments.length}</p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600 mb-1">Successful</p>
                  <p className="text-2xl font-bold text-green-900">
                    {payments.filter(p => p.payment_status === 'success').length}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-600 mb-1">Total Paid</p>
                  <p className="text-2xl font-bold text-purple-900">{formatCurrency(getTotalPaid())}</p>
                </div>
              </div>

              {/* Payment List */}
              <div className="space-y-3">
                {payments.map((payment, index) => (
                  <div
                    key={payment.id || index}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {formatMembershipYear(payment.membership_year_start, payment.membership_year_end)}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(payment.membership_year_start)} - {formatDate(payment.membership_year_end)}
                        </p>
                      </div>
                      {getStatusBadge(payment.payment_status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Amount</p>
                        <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Payment Date</p>
                        <p className="font-medium text-gray-900">
                          {payment.payment_date ? formatDate(payment.payment_date) : 'Not paid'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Transaction ID</p>
                        <p className="font-medium text-gray-900 truncate" title={payment.transaction_id}>
                          {payment.transaction_id || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {payment.razorpay_payment_id && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Razorpay Payment ID:</p>
                        <p className="text-xs font-mono text-gray-700 truncate" title={payment.razorpay_payment_id}>
                          {payment.razorpay_payment_id}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;
