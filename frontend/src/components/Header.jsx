import React from 'react';
import { CreditCard } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary-600 rounded-lg">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Membership Payment System
              </h1>
              <p className="text-xs text-gray-500">Sunsys Technologies Pvt Ltd</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Membership Fee:</span> ₹1,200/year
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
