import React, { useState, useEffect } from 'react';
import { Calculator, Loader2, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';
import { paymentAPI } from '../services/api';
import { formatCurrency, formatMembershipYear } from '../utils/helpers';

const PaymentCalculation = ({ member, onProceedToPayment }) => {
  const [calculation, setCalculation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCalculation();
  }, [member.id]);

  const fetchCalculation = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await paymentAPI.calculate(member.id);
      setCalculation(response);
    } catch (err) {
      setError(err.message || 'Failed to calculate payment');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (calculation?.allPaid) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">All Paid Up!</h3>
          <p className="text-gray-600">{calculation.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg">
          <Calculator className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payment Calculation</h2>
          <p className="text-sm text-gray-600">{calculation?.message}</p>
        </div>
      </div>

      {calculation?.hasGap && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Sequential Payment Required</h4>
              <p className="text-sm text-amber-700">
                You have skipped membership year(s). According to our policy, you must pay for all 
                years sequentially starting from {calculation.gapYear}-{calculation.gapYear + 1}.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Payable Membership Years
          </h3>
          <div className="space-y-2">
            {calculation?.payableYears?.map((year, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary-100 rounded-full">
                    <span className="text-sm font-semibold text-primary-700">
                      {index + 1}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {formatMembershipYear(year.start, year.end)}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-700">₹1,200</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <span className="text-lg font-medium text-gray-700">Total Years:</span>
            <span className="text-lg font-semibold text-gray-900">
              {calculation?.payableYears?.length || 0}
            </span>
          </div>
          
          <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border-2 border-primary-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-700 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-primary-900">
                  {formatCurrency(calculation?.totalAmount || 0)}
                </p>
              </div>
              <div className="flex items-center justify-center w-16 h-16 bg-white rounded-full border-2 border-primary-300">
                <CreditCard className="w-8 h-8 text-primary-600" />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onProceedToPayment(calculation)}
          className="btn-primary w-full flex items-center justify-center space-x-2 text-lg py-3"
        >
          <CreditCard className="w-5 h-5" />
          <span>Proceed to Payment</span>
        </button>

        <p className="text-xs text-gray-500 text-center">
          Secure payment powered by Razorpay
        </p>
      </div>
    </div>
  );
};

export default PaymentCalculation;
