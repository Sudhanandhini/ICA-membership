import React, { useState, useEffect, useRef } from 'react';
import { Mail, ShieldCheck, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import axios from 'axios';

const OtpVerification = ({ member, maskedEmail, onVerified, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take only last digit
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      setError('');

      // Focus appropriate input
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();

      // Auto-submit if 6 digits pasted
      if (pastedData.length === 6) {
        handleVerify(pastedData);
      }
    }
  };

  const handleVerify = async (otpString) => {
    const code = otpString || otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/members/verify-otp`, {
        memberId: member.id,
        otp: code
      });

      if (response.data.success && response.data.verified) {
        onVerified(response.data.member);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setResending(true);
    setError('');

    try {
      await axios.post(`${API_URL}/members/send-otp`, {
        memberId: member.id
      });
      setResendCooldown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="card max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Verify Your Identity</h3>
        <p className="text-sm text-gray-600 mt-2">
          We've sent a 6-digit verification code to
        </p>
        <div className="flex items-center justify-center space-x-2 mt-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-800">{maskedEmail}</span>
        </div>
      </div>

      {/* Member Info */}
      <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-sm text-gray-600">Verifying for</p>
        <p className="font-semibold text-gray-900">{member.name}</p>
        <p className="text-xs text-gray-500">Folio: {member.folio_number}</p>
      </div>

      {/* OTP Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
          Enter Verification Code
        </label>
        <div className="flex justify-center space-x-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                error ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              disabled={loading}
            />
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Verify Button */}
      <button
        onClick={() => handleVerify()}
        disabled={loading || otp.join('').length !== 6}
        className="w-full btn-primary flex items-center justify-center space-x-2 mb-4"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            <span>Verify OTP</span>
          </>
        )}
      </button>

      {/* Resend & Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Search</span>
        </button>

        <button
          onClick={handleResend}
          disabled={!canResend || resending}
          className="text-sm flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 hover:text-blue-800"
        >
          {resending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>
            {canResend ? 'Resend OTP' : `Resend in ${resendCooldown}s`}
          </span>
        </button>
      </div>
    </div>
  );
};

export default OtpVerification;
