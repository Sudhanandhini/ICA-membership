import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Loader2, Download } from 'lucide-react';
import axios from 'axios';

const MonthlyPaymentReport = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedYear]);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_URL}/admin/monthly-report`, {
        params: { year: selectedYear }
      });
      setReportData(response.data.report || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch report');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getTotalForYear = () => {
    return reportData.reduce((sum, month) => sum + (month.amount || 0), 0);
  };

  const getTotalPaymentsForYear = () => {
    return reportData.reduce((sum, month) => sum + (month.count || 0), 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleExport = () => {
    // Create CSV content
    let csv = 'Month,Payments,Amount\n';
    reportData.forEach((month, index) => {
      csv += `${months[index]},${month.count || 0},${month.amount || 0}\n`;
    });
    csv += `\nTotal,${getTotalPaymentsForYear()},${getTotalForYear()}\n`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-report-${selectedYear}.csv`;
    a.click();
  };

  return (
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
            className="input-field w-32"
          >
            {[2022, 2023, 2024, 2025, 2026].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center space-x-2"
            disabled={reportData.length === 0}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 mb-1">Total Payments</p>
                  <p className="text-2xl font-bold text-blue-900">{getTotalPaymentsForYear()}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(getTotalForYear())}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="overflow-x-auto">
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
                {months.map((month, index) => {
                  const monthData = reportData[index] || { count: 0, amount: 0 };
                  const percentage = getTotalForYear() > 0 
                    ? ((monthData.amount / getTotalForYear()) * 100).toFixed(1)
                    : 0;

                  return (
                    <tr key={month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{month}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{monthData.count}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(monthData.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{percentage}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{getTotalPaymentsForYear()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(getTotalForYear())}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthlyPaymentReport;
