import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, Edit, Trash2, RotateCcw, Loader2, Eye, AlertCircle, CheckCircle, X, Download } from 'lucide-react';
import axios from 'axios';
import PaymentHistoryModal from './PaymentHistoryModal';
import EditMemberModal from './EditMemberModal';

const MembersList = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selectedYear, setSelectedYear] = useState('2025-2026');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [error, setError] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [editingMember, setEditingMember] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const years = [
    '2021-2022', '2022-2023', '2023-2024', '2024-2025',
    '2025-2026', '2026-2027', '2027-2028', '2028-2029'
  ];

  useEffect(() => {
    fetchMembers();
  }, [page, statusFilter, searchTerm, paymentFilter, genderFilter, selectedYear]);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    
    try {
      let url = `${API_URL}/admin/members`;
      let params = {
        page: page,
        limit: 20,
        search: searchTerm || undefined
      };

      // Add gender filter if selected
      if (genderFilter !== 'all') {
        params.gender = genderFilter;
      }

      // If filtering by payment status for specific year
      if (paymentFilter !== 'all') {
        url = `${API_URL}/admin/members/payment-status`;
        params = {
          ...params,
          year: selectedYear,
          status: paymentFilter
        };
      } else if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      console.log('Fetching members:', { url, params });

      const response = await axios.get(url, { params });

      if (response.data.success && response.data.members) {
        setMembers(response.data.members);
        setTotalPages(response.data.pagination.totalPages);
        setTotalMembers(response.data.pagination.totalMembers);
      } else {
        setMembers([]);
        setError('No members found');
      }
    } catch (err) {
      console.error('Fetch members error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatusByPayment = async () => {
    if (!window.confirm(`Update all member statuses based on payment for ${selectedYear}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.put(`${API_URL}/admin/members/update-status-by-payment`, {
        year: selectedYear
      });

      if (response.data.success) {
        alert(`✅ Updated: ${response.data.updated.active} active, ${response.data.updated.inactive} inactive`);
        fetchMembers();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPaymentFilter('all');
    setGenderFilter('all');
    setStatusFilter('active');
    setPage(1);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();

      if (genderFilter !== 'all') params.append('gender', genderFilter);
      if (searchTerm) params.append('search', searchTerm);

      if (paymentFilter !== 'all') {
        params.append('year', selectedYear);
        params.append('status', paymentFilter);
      }

      const response = await axios.get(`${API_URL}/admin/members/export-excel?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Members_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleSoftDelete = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName}?`)) {
      return;
    }

    try {
      await axios.put(`${API_URL}/admin/members/${memberId}/soft-delete`);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleRestore = async (memberId, memberName) => {
    if (!window.confirm(`Restore ${memberName}?`)) {
      return;
    }

    try {
      await axios.put(`${API_URL}/admin/members/${memberId}/restore`);
      fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to restore member');
    }
  };

  const getStatusBadge = (status, deletedAt) => {
    if (deletedAt) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Removed</span>;
    }
    
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-yellow-100 text-yellow-800',
      removed: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </span>
    );
  };

  const hasActiveFilters = searchTerm || paymentFilter !== 'all' || statusFilter !== 'active' || genderFilter !== 'all';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg">
            <Users className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">All Members</h3>
            <p className="text-sm text-gray-600">View and manage member accounts</p>
          </div>
        </div>

        <button
          onClick={updateStatusByPayment}
          className="btn-primary flex items-center space-x-2"
          disabled={loading}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Update Status by Payment</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, folio, email, phone, address, state..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="input-field pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPaymentFilter('all');
              setPage(1);
            }}
            className="input-field pl-10"
            disabled={paymentFilter !== 'all'}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="removed">Removed Only</option>
          </select>
        </div>

        {/* Payment Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              if (e.target.value !== 'all') {
                setStatusFilter('all');
              }
              setPage(1);
            }}
            className="input-field pl-10"
          >
            <option value="all">All Payments</option>
            <option value="paid">✅ Paid</option>
            <option value="unpaid">❌ Not Paid</option>
          </select>
        </div>

        {/* Gender Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
            className="input-field pl-10"
          >
            <option value="all">All Gender</option>
            <option value="Male">👨 Male</option>
            <option value="Female">👩 Female</option>
          </select>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-medium text-gray-700">Active Filters:</span>
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  Search: "{searchTerm}"
                </span>
              )}
              {paymentFilter !== 'all' && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                  {paymentFilter === 'paid' ? '✅ Paid' : '❌ Not Paid'} for {selectedYear}
                </span>
              )}
              {statusFilter !== 'active' && paymentFilter === 'all' && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                  Status: {statusFilter}
                </span>
              )}
              {genderFilter !== 'all' && (
                <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded-full text-xs">
                  {genderFilter === 'Male' ? '👨 Male' : '👩 Female'}
                </span>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <X className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          </div>
        </div>
      )}

      {/* Year Filter (only visible when payment filter is active) */}
      {paymentFilter !== 'all' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Showing members who have {paymentFilter === 'paid' ? '✅ PAID' : '❌ NOT PAID'} for:
                </p>
                {searchTerm && (
                  <p className="text-xs text-blue-700 mt-1">
                    Filtered by search: "{searchTerm}"
                  </p>
                )}
              </div>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setPage(1);
              }}
              className="input-field w-48"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results Info */}
      {!loading && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-gray-700">
            <strong>Showing:</strong> {totalMembers} member(s)
            {paymentFilter !== 'all' && ` who have ${paymentFilter === 'paid' ? '✅ paid' : '❌ not paid'} for ${selectedYear}`}
            {genderFilter !== 'all' && ` | Gender: ${genderFilter}`}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
          <button
            onClick={handleExportExcel}
            disabled={exporting || totalMembers === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Folio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      {paymentFilter !== 'all' 
                        ? `No members ${paymentFilter} for ${selectedYear}${searchTerm ? ` matching "${searchTerm}"` : ''}`
                        : searchTerm 
                        ? `No members found matching "${searchTerm}"` 
                        : 'No members found'}
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{member.folio_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{member.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-4 py-3 text-sm">
                        {getStatusBadge(member.status, member.deleted_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedMember(member)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="View payment history"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {member.deleted_at ? (
                            <button
                              onClick={() => handleRestore(member.id, member.name)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Restore member"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingMember(member)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit member"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSoftDelete(member.id, member.name)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Remove member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages} • Showing {members.length} of {totalMembers} member(s)
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment History Modal */}
      {selectedMember && (
        <PaymentHistoryModal
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          memberFolio={selectedMember.folio_number}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={() => {
            fetchMembers();
            setEditingMember(null);
          }}
        />
      )}
    </div>
  );
};

export default MembersList;