import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, CreditCard, FileSpreadsheet, ArrowRight } from 'lucide-react';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            Membership Payment System
          </h1>
          <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto px-2">
            Seamless membership management with automated payment processing and sequential year validation
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 max-w-4xl mx-auto">
          {/* Member Portal Card */}
          <Link
            to="/member-portal"
            className="card hover:shadow-xl transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-xl group-hover:bg-primary-200 transition-colors">
                <CreditCard className="w-8 h-8 text-primary-600" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              Member Portal
            </h2>
            <p className="text-gray-600 mb-4">
              Search for members, view details, and process membership payments securely
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span>Quick member search</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span>Payment calculation with sequential validation</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span>Secure Razorpay integration</span>
              </li>
            </ul>
          </Link>

          {/* Admin Panel Card */}
          <Link
            to="/admin"
            className="card hover:shadow-xl transition-all duration-300 group bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-xl group-hover:bg-amber-200 transition-colors">
                <Shield className="w-8 h-8 text-amber-600" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              Admin Panel
            </h2>
            <p className="text-gray-600 mb-4">
              Import member data from Excel and manage the membership system
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span>Excel file import (bulk upload)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span>Member management (soft delete/restore)</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-green-600">✓</span>
                <span>System statistics and reports</span>
              </li>
            </ul>
          </Link>
        </div>

        {/* Features Section */}
        <div className="mt-8 sm:mt-16 max-w-4xl mx-auto">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6 sm:mb-8">
            Key Features
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center p-6 bg-white rounded-xl shadow-sm">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Sequential Validation</h4>
              <p className="text-sm text-gray-600">
                Prevents members from skipping years - ensures continuous membership
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-xl shadow-sm">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-4">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Excel Import</h4>
              <p className="text-sm text-gray-600">
                Bulk import members and payment history from Excel files
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-xl shadow-sm">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-4">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Data Safety</h4>
              <p className="text-sm text-gray-600">
                Soft delete with restore - no data is permanently lost
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 sm:mt-16 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs sm:text-sm text-gray-600 px-2 sm:px-8">
          <p>© 2026 Indian Cricket Association. All rights reserved.</p>
          <p>Built By <a href="https://sunsys.in">Sunsys Technologies Pvt Ltd.</a></p>
        </div>

      </div>
    </div>
  );
};

export default HomePage;
