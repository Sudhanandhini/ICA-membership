import React from 'react';
import { User, Phone, Mail, FileText, X } from 'lucide-react';

const MemberDetails = ({ member, onClose }) => {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg">
            <User className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Member Details</h2>
            <p className="text-sm text-gray-600">Verified member information</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-6 border border-primary-200">
          <div className="flex items-start space-x-4">
            <div className="flex items-center justify-center w-16 h-16 bg-white rounded-full border-2 border-primary-300">
              <User className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{member.name}</h3>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-medium text-primary-700">
                  Folio Number: {member.folio_number}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg">
              <Phone className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Phone Number</p>
              <p className="font-medium text-gray-900">{member.phone}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg">
              <Mail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email Address</p>
              <p className="font-medium text-gray-900 break-all">{member.email}</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            ✓ Member verified - Ready to process payment
          </p>
        </div>
      </div>
    </div>
  );
};

export default MemberDetails;
