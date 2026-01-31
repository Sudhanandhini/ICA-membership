import React, { useState, useEffect } from 'react';
import { X, Calendar, CreditCard, Check, AlertCircle } from 'lucide-react';
import Loading from './Loading';

const PaymentHistoryModal = ({ memberId, memberName, memberFolio, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchPaymentHistory();
  }, [memberId]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching payment history for member ID:', memberId);

      const response = await fetch(`${API_URL}/admin/members/${memberId}/payments`);
      const result = await response.json();

      console.log('Payment history response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch payment history');
      }

      if (result.success) {
        setData(result);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Check className="w-3 h-3 mr-1" />
          Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        Unpaid
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Payment History</h2>
              <p className="text-sm text-primary-100">{memberName} • {memberFolio}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="py-12">
              <Loading message="Loading payment history..." />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-semibold mb-2">Failed to load payment history</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button
                onClick={fetchPaymentHistory}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data?.payments?.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-semibold">No payment history available</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {data?.summary && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-medium mb-1">Total Periods</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {data.summary.totalPeriods}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium mb-1">Paid Periods</p>
                    <p className="text-2xl font-bold text-green-700">
                      {data.summary.paidPeriods}
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-600 font-medium mb-1">Unpaid Periods</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {data.summary.unpaidPeriods}
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-600 font-medium mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-purple-700">
                      ₹{data.summary.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Details Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data?.payments?.map((payment, index) => (
                      <tr
                        key={index}
                        className={payment.status === 'paid' ? 'bg-green-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className={`w-4 h-4 mr-2 ${
                              payment.status === 'paid' ? 'text-green-600' : 'text-gray-400'
                            }`} />
                            <span className="text-sm font-medium text-gray-900">
                              {payment.period}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getStatusBadge(payment.status)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <span className={`text-sm font-semibold ${
                            payment.status === 'paid' ? 'text-green-700' : 'text-gray-400'
                          }`}>
                            {payment.displayAmount}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`text-sm ${
                            payment.paymentDate ? 'text-gray-900 font-medium' : 'text-gray-400'
                          }`}>
                            {formatDate(payment.paymentDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs font-mono truncate block max-w-xs ${
                            payment.paymentId ? 'text-gray-900 font-medium' : 'text-gray-400'
                          }`}>
                            {payment.paymentId || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Member ID: {data?.member?.id} • Class: {data?.member?.member_class || 'N/A'}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;