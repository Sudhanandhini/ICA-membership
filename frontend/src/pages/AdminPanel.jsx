import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Upload, UserPlus, Users, FileText, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, LogOut } from 'lucide-react';
import axios from 'axios';
import AddMemberForm from '../components/AddMemberForm';
import MembersList from '../components/MembersList';
import MonthlyPaymentReport from '../components/MonthlyPaymentReport';
import AdminLogin from '../components/AdminLogin';
import { adminAPI } from '../services/api';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('view-members');
  const [stats, setStats] = useState({
    activeMembers: 0,
    totalPayments: 0,
    totalRevenue: 0
  });

  // Excel Import State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      adminAPI.verifyToken()
        .then(() => {
          setIsAuthenticated(true);
          setAuthChecking(false);
        })
        .catch(() => {
          localStorage.removeItem('adminToken');
          setIsAuthenticated(false);
          setAuthChecking(false);
        });
    } else {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/stats`, { headers: getAuthHeaders() });
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleMemberAdded = () => {
    fetchStats();
    setActiveTab('view-members');
  };

  // Excel Import Functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['.xlsx', '.xls', '.csv'];
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExt)) {
        setUploadError('Please select an Excel file (.xlsx, .xls, or .csv)');
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setUploadError('');
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_URL}/admin/import-excel`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders()
        }
      });

      setUploadResult(response.data);
      setSelectedFile(null);
      
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';

      fetchStats();

    } catch (err) {
      setUploadError(err.response?.data?.error || err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-600">Manage members and system</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/')}
                className="btn-secondary flex items-center space-x-2"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Members</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeMembers}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Payments</p>
                <p className="text-3xl font-bold text-gray-900">{stats.successfulPayments || stats.totalPayments}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{(stats.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('excel-import')}
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
                activeTab === 'excel-import'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span>Excel Import</span>
            </button>

            <button
              onClick={() => setActiveTab('add-member')}
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
                activeTab === 'add-member'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              <span>Add Member</span>
            </button>

            <button
              onClick={() => setActiveTab('view-members')}
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
                activeTab === 'view-members'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>View Members</span>
            </button>

            <button
              onClick={() => setActiveTab('monthly-report')}
              className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
                activeTab === 'monthly-report'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Monthly Report</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {/* Excel Import Tab */}
          {activeTab === 'excel-import' && (
            <div className="card">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg">
                  <Upload className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Import Member Data</h2>
                  <p className="text-sm text-gray-600">Upload Excel file with member and payment information</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File (.xlsx, .xls, .csv)
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2"
                    disabled={isUploading}
                  />
                </div>

                {selectedFile && (
                  <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">{selectedFile.name}</p>
                      <p className="text-xs text-blue-600">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="btn-primary w-full flex items-center justify-center space-x-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading and Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Upload and Import</span>
                    </>
                  )}
                </button>

                {uploadError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900 mb-1">Upload Error</h4>
                      <p className="text-sm text-red-700">{uploadError}</p>
                    </div>
                  </div>
                )}

                {uploadResult && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3 mb-4">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-green-900 mb-1">Import Successful!</h4>
                        <p className="text-sm text-green-700">Your Excel file has been processed</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{uploadResult.totalRows}</p>
                        <p className="text-xs text-gray-600">Total Rows</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{uploadResult.membersAdded}</p>
                        <p className="text-xs text-gray-600">New Members</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{uploadResult.membersUpdated}</p>
                        <p className="text-xs text-gray-600">Updated</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-primary-600">{uploadResult.paymentsAdded}</p>
                        <p className="text-xs text-gray-600">Payments</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{uploadResult.errors}</p>
                        <p className="text-xs text-gray-600">Errors</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'add-member' && <AddMemberForm onSuccess={handleMemberAdded} />}
          {activeTab === 'view-members' && <MembersList />}
          {activeTab === 'monthly-report' && <MonthlyPaymentReport />}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;