import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Download, DollarSign, FileText, User, CreditCard, Filter, X, Search } from 'lucide-react';
import axios from 'axios';

const MonthlyPaymentReport = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [yearlyData, setYearlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    period: '',
    amountMin: '',
    amountMax: '',
    chapter: ''
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const periods = [
    '2021-2022', '2022-2023', '2023-2024', '2024-2025',
    '2025-2026', '2026-2027', '2027-2028', '2028-2029'
  ];

  useEffect(() => {
    fetchMonthlyReport();
    fetchYearlyReport();
  }, [selectedYear, selectedMonth]);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        year: selectedYear,
        month: selectedMonth,
        ...filters
      };

      console.log('Fetching with params:', params);

      const response = await axios.get(`${API_URL}/admin/monthly-report`, { params });

      if (response.data.success) {
        setReportData(response.data);
      } else {
        setError('Failed to load report data');
      }
    } catch (err) {
      console.error('Fetch report error:', err);
      setError(err.response?.data?.error || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyReport = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/yearly-report`);
      if (response.data.success) {
        setYearlyData(response.data.yearlyData);
      }
    } catch (err) {
      console.error('Fetch yearly report error:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchMonthlyReport();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      period: '',
      amountMin: '',
      amountMax: '',
      chapter: ''
    });
    setShowFilters(false);
  };

  const hasActiveFilters = Object.values(filters).some(val => val !== '');

  const handleExportTransactions = () => {
    if (!reportData || !reportData.transactions) return;

    let csv = 'Date,Folio Number,Name,Email,Phone,Chapter,Period,Amount,Payment ID\n';
    
    reportData.transactions.forEach(txn => {
      csv += `${new Date(txn.payment_date).toLocaleDateString('en-IN')},`;
      csv += `${txn.folio_number},`;
      csv += `"${txn.name}",`;
      csv += `${txn.email},`;
      csv += `${txn.phone},`;
      csv += `${txn.chapter || 'N/A'},`;
      csv += `${txn.period},`;
      csv += `₹${txn.amount.toFixed(2)},`;
      csv += `${txn.payment_id}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${selectedYear}${selectedMonth ? `-${selectedMonth}` : ''}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Monthly Report Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Monthly Payment Report</h3>
              <p className="text-sm text-gray-600">View month-wise payment statistics</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="input-field"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading report...</p>
          </div>
        ) : reportData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium mb-1">Total Payments</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {reportData.summary.totalPayments}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-700">
                      ₹{reportData.summary.totalRevenue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            {/* Monthly Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">No. of Payments</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.monthlyData.map((month, index) => {
                    const percentage = reportData.summary.totalRevenue > 0
                      ? ((month.revenue / reportData.summary.totalRevenue) * 100).toFixed(1)
                      : '0';

                    return (
                      <tr 
                        key={index} 
                        className={`${month.payments > 0 ? 'bg-green-50 cursor-pointer hover:bg-green-100' : 'hover:bg-gray-50'}`}
                        onClick={() => month.payments > 0 && setSelectedMonth(month.monthNumber)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{month.month}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{month.payments}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          ₹{month.revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{percentage}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                      {reportData.summary.totalPayments}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                      ₹{reportData.summary.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">100%</td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-xs text-gray-500 mt-2 text-center">
                💡 Click on any month row to view detailed transactions
              </p>
            </div>

            {/* Detailed Transactions Section */}
            {reportData.transactions && reportData.transactions.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Payment Transactions {selectedMonth && `- ${months[selectedMonth - 1]}`}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {reportData.transactions.length} transaction(s) found
                        {hasActiveFilters && ` (filtered from ${reportData.summary.totalPayments})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`btn-secondary flex items-center space-x-2 ${hasActiveFilters ? 'bg-primary-100 border-primary-300' : ''}`}
                    >
                      <Filter className="w-4 h-4" />
                      <span>Filters {hasActiveFilters && `(${Object.values(filters).filter(v => v).length})`}</span>
                    </button>
                    {selectedMonth && (
                      <button
                        onClick={() => setSelectedMonth(null)}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Show All Months</span>
                      </button>
                    )}
                    <button
                      onClick={handleExportTransactions}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* Filter Section */}
                {showFilters && (
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Search */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Search (Name, Folio, Email)
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            placeholder="Search..."
                            className="input-field pl-10"
                          />
                        </div>
                      </div>

                      {/* Date From */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date From
                        </label>
                        <input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                          className="input-field"
                        />
                      </div>

                      {/* Date To */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date To
                        </label>
                        <input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                          className="input-field"
                        />
                      </div>

                      {/* Period */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Payment Period
                        </label>
                        <select
                          value={filters.period}
                          onChange={(e) => handleFilterChange('period', e.target.value)}
                          className="input-field"
                        >
                          <option value="">All Periods</option>
                          {periods.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* Amount Min */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Min Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={filters.amountMin}
                          onChange={(e) => handleFilterChange('amountMin', e.target.value)}
                          placeholder="0"
                          className="input-field"
                        />
                      </div>

                      {/* Amount Max */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={filters.amountMax}
                          onChange={(e) => handleFilterChange('amountMax', e.target.value)}
                          placeholder="10000"
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3 mt-4">
                      <button
                        onClick={clearFilters}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Clear Filters</span>
                      </button>
                      <button
                        onClick={applyFilters}
                        className="btn-primary flex items-center space-x-2"
                      >
                        <Filter className="w-4 h-4" />
                        <span>Apply Filters</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Filtered Summary */}
                {hasActiveFilters && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Filtered Results:</strong> {reportData.summary.filteredPayments} transactions • 
                      ₹{reportData.summary.filteredRevenue.toLocaleString('en-IN')} total
                    </p>
                  </div>
                )}

                {/* Transactions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Folio</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {reportData.transactions.map((txn, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDate(txn.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {txn.folio_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="flex items-center">
                              <User className="w-4 h-4 text-gray-400 mr-2" />
                              {txn.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {txn.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {txn.phone}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {txn.period}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">
                            ₹{txn.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center">
                              <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="font-mono text-xs truncate max-w-xs">
                                {txn.payment_id}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No report data available</p>
          </div>
        )}
      </div>

      {/* Yearly Summary Card */}
      {yearlyData.length > 0 && (
        <div className="card">
          <div className="flex items-center space-x-3 mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Yearly Summary</h3>
              <p className="text-sm text-gray-600">Payment trends across years</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {yearlyData.map((year) => (
              <div key={year.year} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                <p className="text-sm text-gray-600 mb-1">Year {year.year}</p>
                <p className="text-2xl font-bold text-gray-900 mb-2">
                  ₹{year.revenue.toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-gray-600">
                  {year.payments} payment{year.payments !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPaymentReport;