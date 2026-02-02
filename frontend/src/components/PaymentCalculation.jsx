import React, { useState } from 'react';
import { CreditCard, Calendar, IndianRupee, AlertCircle } from 'lucide-react';

const PaymentCalculation = ({ calculation, onProceedToPayment }) => {
  const [selectedPlan, setSelectedPlan] = useState('1_year'); // Default to 1-year plan

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

  // Calculate amounts based on selected plan
  const planDetails = {
    '1_year': {
      label: '1 Year Plan',
      amountPerYear: 1200,
      years: 1,
      totalAmount: 1200,
      savings: 0
    },
    '3_year': {
      label: '3 Year Plan',
      amountPerYear: 1133.33,
      years: 3,
      totalAmount: 3400,
      savings: 200
    }
  };

  const currentPlan = planDetails[selectedPlan];

  // Filter out past periods (amount = 0)
  const applicablePaymentStatus = paymentStatus ? 
    paymentStatus.filter(status => status.status !== 'not_applicable') : 
    [];

  const handleProceedToPayment = () => {
    // Pass selected plan to parent component
    onProceedToPayment({ 
      plan: selectedPlan,
      amount: currentPlan.totalAmount,
      years: currentPlan.years
    });
  };

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

      {/* Payment Plan Selection */}
      {canPay && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Choose Payment Plan:</h4>
          <div className="space-y-3">
            {/* 1-Year Plan */}
            <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedPlan === '1_year' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-center">
                <input
                  type="radio"
                  name="payment_plan"
                  value="1_year"
                  checked={selectedPlan === '1_year'}
                  onChange={() => setSelectedPlan('1_year')}
                  className="w-4 h-4 text-blue-600"
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">1 Year Plan</span>
                    <span className="text-lg font-bold text-gray-900">₹1,200</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Pay annually - ₹1,200/year</p>
                </div>
              </div>
            </label>

            {/* 3-Year Plan */}
            <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedPlan === '3_year' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-center">
                <input
                  type="radio"
                  name="payment_plan"
                  value="3_year"
                  checked={selectedPlan === '3_year'}
                  onChange={() => setSelectedPlan('3_year')}
                  className="w-4 h-4 text-green-600"
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-gray-900">3 Year Plan</span>
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        Save ₹200!
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">₹3,400</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Pay once for 3 years - ₹1,133/year</p>
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <IndianRupee className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Selected Plan</p>
              <p className="text-xs text-green-700">{currentPlan.label}</p>
            </div>
          </div>
          <span className="text-lg font-bold text-green-900">
            {currentPlan.years} year{currentPlan.years > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 bg-primary-50 border-2 border-primary-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-primary-900">Total Amount</p>
              {selectedPlan === '3_year' && (
                <p className="text-xs text-primary-700">You save ₹200 with 3-year plan!</p>
              )}
            </div>
          </div>
          <span className="text-2xl font-bold text-primary-900">
            ₹{currentPlan.totalAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Payment Status Overview - Only show applicable periods */}
      {applicablePaymentStatus && applicablePaymentStatus.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Payment History:</h4>
          <div className="grid grid-cols-4 gap-2">
            {applicablePaymentStatus.map((status, index) => (
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
            ))}
          </div>
          
          {/* Show note if member has non-applicable periods */}
          {paymentStatus && paymentStatus.length > applicablePaymentStatus.length && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              ℹ️ Showing only applicable periods. {paymentStatus.length - applicablePaymentStatus.length} period(s) 
              marked as "N/A" (before you joined).
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {canPay ? (
          <>
            <button
              onClick={handleProceedToPayment}
              className="w-full btn-primary py-3 text-lg font-semibold"
            >
              Proceed to Payment - ₹{currentPlan.totalAmount.toLocaleString()}
            </button>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Note:</span> {selectedPlan === '3_year' 
                  ? 'This payment covers 3 years of membership. ' 
                  : 'This payment covers 1 year of membership. '}
                Secure payment via Razorpay.
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
          {selectedPlan === '3_year' && ' 3-year plan covers consecutive periods.'}
        </p>
      </div>
    </div>
  );
};

export default PaymentCalculation;