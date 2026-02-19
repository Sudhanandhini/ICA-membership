import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import axios from 'axios';
import MemberSearch from '../components/MemberSearch';
import MemberDetails from '../components/MemberDetails';
import PaymentCalculation from '../components/PaymentCalculation';
import PaymentSuccess from '../components/PaymentSuccess';
import OtpVerification from '../components/OtpVerification';
import Loading from '../components/Loading';
import { paymentAPI, handleRazorpayPayment } from '../services/api';
import { loadRazorpayScript } from '../utils/helpers';

const MemberPortal = () => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [paymentCalculation, setPaymentCalculation] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [error, setError] = useState('');
  const [currentPaymentOption, setCurrentPaymentOption] = useState(null);
  const navigate = useNavigate();

  // OTP states
  const [pendingMember, setPendingMember] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Calculate payment when member is selected
  useEffect(() => {
    if (selectedMember) {
      calculatePayment();
    }
  }, [selectedMember]);

  const handleMemberSelect = async (member) => {
    setError('');
    setPaymentCalculation(null);
    setPaymentSuccess(null);
    setSendingOtp(true);

    try {
      const response = await axios.post(`${API_URL}/members/send-otp`, {
        memberId: member.id
      });

      if (response.data.success) {
        setPendingMember(member);
        setMaskedEmail(response.data.email);
        setOtpStep(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpVerified = (verifiedMember) => {
    setSelectedMember(verifiedMember);
    setPendingMember(null);
    setMaskedEmail('');
    setOtpStep(false);
  };

  const handleOtpBack = () => {
    setPendingMember(null);
    setMaskedEmail('');
    setOtpStep(false);
    setError('');
  };

  const calculatePayment = async () => {
    if (!selectedMember || !selectedMember.id) {
      setError('No member selected');
      return;
    }

    setIsCalculating(true);
    setError('');

    try {
      console.log('Calculating payment for member:', selectedMember);

      const response = await fetch(`${API_URL}/payments/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: selectedMember.id
        }),
      });

      console.log('Response status:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.success && data.calculation) {
        setPaymentCalculation(data.calculation);
      } else {
        throw new Error(data.error || 'Calculation failed');
      }
    } catch (err) {
      console.error('Payment calculation error:', err);
      setError(`Failed to calculate payment: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleProceedToPayment = async (selectedOption) => {
    if (!paymentCalculation) {
      setError('No payment calculation available');
      return;
    }

    // selectedOption is the payment option/plan object from PaymentCalculation
    await initiatePayment(paymentCalculation, selectedOption);
  };

  const initiatePayment = async (calculation, selectedOption = null) => {
    if (!selectedMember) {
      setError('Invalid payment data');
      return;
    }

    // Require selected option to proceed
    if (!selectedOption) {
      setError('Please select a payment option');
      return;
    }

    setIsProcessingPayment(true);
    setCurrentPaymentOption(selectedOption);
    setError('');

    try {
      if (!window.Razorpay) {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Failed to load Razorpay. Please refresh the page.');
        }
      }

      // Prepare payment data from selected option
      const payableYears = selectedOption.periods.map((_, idx) => ({
        year: selectedOption.years[idx],
        amount: 1200
      }));

      const orderData = await paymentAPI.initiate({
        memberId: selectedMember.id,
        payableYears: payableYears,
        totalAmount: selectedOption.totalAmount,
        optionId: selectedOption.id,
        periods: selectedOption.periods
      });

      handleRazorpayPayment(
        orderData,
        async (response) => {
          await verifyPayment(response, selectedOption);
        },
        (error) => {
          setError(error.message);
          setIsProcessingPayment(false);
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to initiate payment');
      setIsProcessingPayment(false);
    }
  };

  const verifyPayment = async (razorpayResponse, option) => {
    try {
      const verificationData = await paymentAPI.verify({
        razorpay_order_id: razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
        memberId: selectedMember.id,
        periods: option.periods,
        totalAmount: option.totalAmount
      });

      setPaymentSuccess(verificationData);
      setIsProcessingPayment(false);
    } catch (err) {
      setError(err.message || 'Payment verification failed');
      setIsProcessingPayment(false);
    }
  };

  const handleReset = () => {
    setSelectedMember(null);
    setPaymentCalculation(null);
    setPaymentSuccess(null);
    setError('');
    setIsProcessingPayment(false);
    setIsCalculating(false);
    setPendingMember(null);
    setMaskedEmail('');
    setOtpStep(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Home Button */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm font-medium">Home</span>
            </button>
            <div className="text-right">
              <h1 className="text-base sm:text-xl font-bold text-gray-900">Member Portal</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Membership Fee: ₹1,200/year</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1 w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError('')}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {isProcessingPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-sm mx-4">
              <Loading message="Processing payment..." />
              <p className="text-sm text-gray-600 text-center mt-4">
                Please complete the payment in the Razorpay window
              </p>
            </div>
          </div>
        )}

        {/* Sending OTP overlay */}
        {sendingOtp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-sm mx-4">
              <Loading message="Sending OTP to your email..." />
            </div>
          </div>
        )}

        {paymentSuccess ? (
          <PaymentSuccess paymentData={paymentSuccess} onReset={handleReset} />
        ) : otpStep && pendingMember ? (
          <OtpVerification
            member={pendingMember}
            maskedEmail={maskedEmail}
            onVerified={handleOtpVerified}
            onBack={handleOtpBack}
          />
        ) : selectedMember ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <MemberSearch onMemberSelect={handleMemberSelect} />
              <MemberDetails
                member={selectedMember}
                onClose={() => setSelectedMember(null)}
              />
            </div>
            <div>
              {isCalculating ? (
                <div className="card">
                  <Loading message="Calculating payment..." />
                </div>
              ) : paymentCalculation ? (
                <PaymentCalculation
                  calculation={paymentCalculation}
                  onProceedToPayment={handleProceedToPayment}
                />
              ) : error ? (
                <div className="card">
                  <div className="text-center py-8">
                    <p className="text-red-600">Failed to load payment details</p>
                    <button
                      onClick={calculatePayment}
                      className="mt-4 btn-primary"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MemberSearch onMemberSelect={handleMemberSelect} />

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                How to Use This System
              </h3>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full font-semibold text-xs flex-shrink-0">
                    1
                  </span>
                  <span>Search for a member by entering their name in the search field</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full font-semibold text-xs flex-shrink-0">
                    2
                  </span>
                  <span>Select the member from the search results</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full font-semibold text-xs flex-shrink-0">
                    3
                  </span>
                  <span>A verification code (OTP) will be sent to your registered email</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full font-semibold text-xs flex-shrink-0">
                    4
                  </span>
                  <span>Enter the 6-digit OTP to verify your identity</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full font-semibold text-xs flex-shrink-0">
                    5
                  </span>
                  <span>View payment details and proceed to payment via Razorpay</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full font-semibold text-xs flex-shrink-0">
                    6
                  </span>
                  <span>After successful payment, membership is activated immediately</span>
                </li>
              </ol>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">Important:</span> You cannot skip membership years.
                  If you have pending years, you must pay for all years sequentially.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 sm:py-6 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-0 text-xs sm:text-sm text-gray-600 px-4 sm:px-8">
          <p>© 2026 Indian Cricket Association. All rights reserved.</p>
          <p>Built By <a href="https://sunsys.in">Sunsys Technologies Pvt Ltd.</a></p>
        </div>
      </footer>
    </div>
  );
};

export default MemberPortal;