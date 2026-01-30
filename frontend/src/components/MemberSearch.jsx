import React, { useState } from 'react';
import { Search, User, Loader2 } from 'lucide-react';
import { memberAPI } from '../services/api';

const MemberSearch = ({ onMemberSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (searchTerm.trim().length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }

    setIsSearching(true);
    setError('');
    setSearchResults([]);

    try {
      const response = await memberAPI.search(searchTerm.trim());
      setSearchResults(response.members || []);
      
      if (response.members?.length === 0) {
        setError('No members found matching your search');
      }
    } catch (err) {
      setError(err.message || 'Failed to search members');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMemberClick = (member) => {
    onMemberSelect(member);
    setSearchTerm('');
    setSearchResults([]);
    setError('');
  };

  return (
    <div className="card">
      <div className="flex items-center space-x-3 mb-4">
        <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg">
          <Search className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Search Member</h2>
          <p className="text-sm text-gray-600">Enter member name to get started</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Member Name
          </label>
          <div className="relative">
            <input
              id="search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter member name..."
              className="input-field pl-10"
              disabled={isSearching}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSearching || searchTerm.trim().length < 2}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Search Member</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Search Results ({searchResults.length})
          </h3>
          <div className="space-y-2">
            {searchResults.map((member) => (
              <button
                key={member.id}
                onClick={() => handleMemberClick(member)}
                className="w-full p-4 bg-gray-50 hover:bg-primary-50 border border-gray-200 hover:border-primary-300 rounded-lg text-left transition-all duration-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full border-2 border-gray-200">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{member.name}</h4>
                    <p className="text-sm text-gray-600">Folio: {member.folio_number}</p>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                      <span>{member.phone}</span>
                      <span>{member.email}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberSearch;
