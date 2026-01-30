import React from 'react';
import { CheckCircle2, Download, Home } from 'lucide-react';
import { formatCurrency, formatMembershipYear, formatDateTime } from '../utils/helpers';

const PaymentSuccess = ({ paymentData, onReset }) => {
  const handleDownloadReceipt = () => {
    // In a real application, this would generate a PDF receipt
    alert('Receipt download functionality would be implemented here');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h2>
          <p className="text-gray-600">
            Your membership has been activated successfully
          </p>
        </div>

        <div className="space-y-6">
          {/* Payment Details */}
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Payment Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Transaction ID</p>
                <p className="font-medium text-gray-900 break-all">
                  {paymentData?.payment?.id}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Amount Paid</p>
                <p className="font-semibold text-gray-900 text-lg">
                  {formatCurrency(paymentData?.payment?.amount)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Payment Method</p>
                <p className="font-medium text-gray-900 capitalize">
                  {paymentData?.payment?.method || 'Online'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Status</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {paymentData?.payment?.status || 'Success'}
                </span>
              </div>
            </div>
          </div>

          {/* Member Details */}
          {paymentData?.member && (
            <div className="p-6 bg-primary-50 rounded-xl border border-primary-200">
              <h3 className="text-sm font-medium text-primary-900 mb-4">Member Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-700">Name:</span>
                  <span className="font-medium text-primary-900">{paymentData.member.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700">Folio Number:</span>
                  <span className="font-medium text-primary-900">{paymentData.member.folio_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700">Email:</span>
                  <span className="font-medium text-primary-900">{paymentData.member.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Activated Years */}
          {paymentData?.activatedYears && paymentData.activatedYears.length > 0 && (
            <div className="p-6 bg-green-50 rounded-xl border border-green-200">
              <h3 className="text-sm font-medium text-green-900 mb-4">
                Activated Membership Years
              </h3>
              <div className="space-y-2">
                {paymentData.activatedYears.map((year, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white rounded-lg"
                  >
                    <span className="font-medium text-gray-900">
                      {formatMembershipYear(year.start, year.end)}
                    </span>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleDownloadReceipt}
              className="btn-secondary flex-1 flex items-center justify-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Download Receipt</span>
            </button>
            <button
              onClick={onReset}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              A confirmation email has been sent to your registered email address.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
