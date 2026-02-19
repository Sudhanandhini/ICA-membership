import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MemberPortal from './pages/MemberPortal';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Router basename="/ica_membership">
      <Routes >
        <Route path="/" element={<HomePage />} />
        <Route path="/member-portal" element={<MemberPortal />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
