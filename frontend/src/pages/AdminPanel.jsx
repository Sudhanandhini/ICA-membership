import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Users, TrendingUp, Download, UserPlus, List, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import axios from 'axios';
import AddMemberForm from '../components/AddMemberForm';
import MembersList from '../components/MembersList';
import MonthlyPaymentReport from '../components/MonthlyPaymentReport';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Fetch stats on component mount
  React.useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/stats`);
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['.xlsx', '.xls', '.csv'];
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExt)) {
        setError('Please select an Excel file (.xlsx, .xls, or .csv)');
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setError('');
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('importedBy', 'admin');

    try {
      const response = await axios.post(`${API_URL}/admin/import-excel`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadResult(response.data.results);
      setSelectedFile(null);
      
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';

      fetchStats();

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const tabs = [
    { id: 'import', label: 'Excel Import', icon: Upload },
    { id: 'add', label: 'Add Member', icon: UserPlus },
    { id: 'members', label: 'View Members', icon: List },
    { id: 'report', label: 'Monthly Report', icon: Calendar }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Home</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-xs text-gray-500">Manage members and system</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Members</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.activeMembers}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Payments</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.successfulPayments}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">₹{stats.totalRevenue?.toLocaleString('en-IN')}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'import' && (
          <div>
            {/* Excel Import Section */}
            <div className="card mb-8">
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
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
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

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-900 mb-2">Excel File Format:</h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Required columns: <strong>Folio No., Name, Email</strong></li>
                    <li>• Optional: <strong>Phone, Fee Period, Amount, Payment ID, Date of Payment</strong></li>
                    <li>• The system will automatically add new members and update existing ones</li>
                    <li>• Multiple payment periods per member are supported</li>
                    <li>• Deleted members will be restored if present in the upload</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="card bg-red-50 border border-red-200 mb-8">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900 mb-1">Upload Error</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Result */}
            {uploadResult && (
              <div className="card bg-green-50 border border-green-200">
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

                {uploadResult.errorDetails && uploadResult.errorDetails.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <h5 className="font-medium text-red-900 mb-2 text-sm">Error Details:</h5>
                    <ul className="text-xs text-red-700 space-y-1">
                      {uploadResult.errorDetails.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <AddMemberForm onSuccess={fetchStats} />
        )}

        {activeTab === 'members' && (
          <MembersList />
        )}

        {activeTab === 'report' && (
          <MonthlyPaymentReport />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
