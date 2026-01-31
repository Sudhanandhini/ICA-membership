import React, { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import axios from 'axios';

const AddMemberForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    folio_number: '',
    name: '',
    email: '',
    phone: '',
    gender: 'Male',
    address: '',
    pin_code: '',
    state: '',
    chapter: '',
    member_class: 'New'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate required fields
      if (!formData.folio_number || !formData.name || !formData.email) {
        throw new Error('Please fill in all required fields');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate phone number (10 digits)
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        throw new Error('Phone number must be 10 digits');
      }

      console.log('Submitting member data:', formData);

      const response = await axios.post(`${API_URL}/admin/members`, formData);

      console.log('Add member response:', response.data);

      if (response.data.success) {
        setSuccess('Member added successfully!');
        
        // Reset form
        setFormData({
          folio_number: '',
          name: '',
          email: '',
          phone: '',
          gender: 'Male',
          address: '',
          pin_code: '',
          state: '',
          chapter: '',
          member_class: 'New'
        });

        // Call success callback if provided
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      }
    } catch (err) {
      console.error('Add member error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-6">
        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
          <UserPlus className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Add New Member</h3>
          <p className="text-sm text-gray-600">Create a new member account</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Folio Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Folio Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="folio_number"
            value={formData.folio_number}
            onChange={handleChange}
            placeholder="e.g., VCA-0850"
            className="input-field"
            required
          />
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            className="input-field"
            required
          />
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@example.com"
            className="input-field"
            required
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="10-digit mobile number"
            className="input-field"
            maxLength="10"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gender
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="input-field"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter address"
            className="input-field"
            rows="3"
          />
        </div>

        {/* Pin Code and State */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pin Code
            </label>
            <input
              type="text"
              name="pin_code"
              value={formData.pin_code}
              onChange={handleChange}
              placeholder="e.g., 560001"
              className="input-field"
              maxLength="6"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              placeholder="e.g., Karnataka"
              className="input-field"
            />
          </div>
        </div>

        {/* Chapter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chapter
          </label>
          <input
            type="text"
            name="chapter"
            value={formData.chapter}
            onChange={handleChange}
            placeholder="e.g., Bangalore"
            className="input-field"
          />
        </div>

        {/* Member Class */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member Class
          </label>
          <select
            name="member_class"
            value={formData.member_class}
            onChange={handleChange}
            className="input-field"
          >
            <option value="New">New</option>
            <option value="Renew">Renew</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Adding Member...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>Add Member</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AddMemberForm;