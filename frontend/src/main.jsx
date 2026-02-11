import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// Global axios interceptor - attach admin token to all /admin API calls
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token && config.url && config.url.includes('/admin')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
