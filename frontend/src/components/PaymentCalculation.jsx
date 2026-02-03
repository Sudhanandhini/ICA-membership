import React from 'react';
import { CreditCard, Calendar, IndianRupee, AlertCircle } from 'lucide-react';

const PaymentCalculation = ({ calculation, onProceedToPayment }) => {
  if (!calculation) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No payment data available</p>
        </div>
      </div>
    );
  }

  const {
    memberName,
    folioNumber,
    currentPeriod,
    paymentStatus,
    unpaidPeriods,
    yearsOwed,
    amountPerYear,
    totalDue,
    canPay
  } = calculation;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Payment Calculation</h3>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          {currentPeriod}
        </span>
      </div>

      {/* Member Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Member</p>
        <p className="font-semibold text-gray-900">{memberName}</p>
        <p className="text-sm text-gray-500">{folioNumber}</p>
      </div>

      {/* Payment Summary */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">Unpaid Periods</p>
              <p className="text-xs text-amber-700">{yearsOwed} year(s) pending</p>
            </div>
          </div>
          <span className="text-lg font-bold text-amber-900">{yearsOwed}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <IndianRupee className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Amount Per Year</p>
              <p className="text-xs text-green-700">Fixed membership fee</p>
            </div>
          </div>
          <span className="text-lg font-bold text-green-900">₹{amountPerYear.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-primary-50 border-2 border-primary-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-primary-900">Total Amount Due</p>
              <p className="text-xs text-primary-700">{yearsOwed} × ₹{amountPerYear.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-primary-900">₹{totalDue.toLocaleString()}</span>
        </div>
      </div>

      {/* Unpaid Periods List */}
      {unpaidPeriods && unpaidPeriods.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Periods to Pay:</h4>
          <div className="space-y-2">
            {unpaidPeriods.map((period, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{period.period}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  ₹{period.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Status Overview */}
      {paymentStatus && paymentStatus.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment History:</h4>
          <div className="grid grid-cols-4 gap-2">
            {paymentStatus.map((status, index) => {
              if (status.status === 'na') {
                // Show blank/NA for years before joining
                return (
                  <div key={index} className="p-2 rounded text-center bg-white border border-gray-200 opacity-40">
                    <p className="text-xs font-medium text-gray-400">{status.period}</p>
                    <p className="text-xs mt-1 text-gray-300">N/A</p>
                  </div>
                );
              }
              return (
                <div
                  key={index}
                  className={`p-2 rounded text-center ${
                    status.status === 'paid'
                      ? 'bg-green-100 border border-green-300'
                      : 'bg-gray-100 border border-gray-300'
                  }`}
                >
                  <p className="text-xs font-medium text-gray-700">{status.period}</p>
                  <p className={`text-xs mt-1 ${
                    status.status === 'paid' ? 'text-green-700' : 'text-gray-500'
                  }`}>
                    {status.status === 'paid' ? '✓ Paid' : 'Unpaid'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {canPay ? (
          <>
            <button
              onClick={onProceedToPayment}
              className="w-full btn-primary py-3 text-lg font-semibold"
            >
              Proceed to Payment - ₹{totalDue.toLocaleString()}
            </button>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Note:</span> You must pay for all pending years 
                sequentially. Secure payment via Razorpay.
              </p>
            </div>
          </>
        ) : (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-800 font-semibold">✓ All payments up to date!</p>
            <p className="text-sm text-green-600 mt-1">Your membership is active</p>
          </div>
        )}
      </div>

      {/* Important Notice */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Payment Policy:</span> Membership fees are non-refundable. 
          You cannot skip years - all pending periods must be paid in sequence.
        </p>
      </div>
    </div>
  );
};

export default PaymentCalculation;