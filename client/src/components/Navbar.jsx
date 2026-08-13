import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, New: 0, Assigned: 0, 'In Progress': 0, Closed: 0 });

  useEffect(() => {
    if (user) {
      apiFetch('/tickets')
        .then(data => {
          const tickets = Array.isArray(data) ? data : (data.tickets || []);
          const s = tickets.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            acc.total += 1;
            return acc;
          }, { total: 0, New: 0, Assigned: 0, 'In Progress': 0, Closed: 0 });
          setStats(s);
        })
        .catch(console.error);
    }
  }, [user, location.pathname]);

  if (!user) return null;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          <img src="/multiplier_logo.png" alt="Multiplier" className="navbar-logo-img" />
        </Link>
        
        <button 
          className="mobile-menu-btn" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>

        <div className={`navbar-menu ${mobileMenuOpen ? 'is-open' : ''}`}>
          <div className="navbar-links">
            <Link 
              to="/" 
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>

            {user.role === 'admin' && (
              <>
                <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Overview</Link>
                <Link to="/admin/users" className={`nav-link ${isActive('/admin/users') ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Users</Link>
                <Link to="/admin/clients" className={`nav-link ${isActive('/admin/clients') ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Clients</Link>
                <Link to="/admin/audit-logs" className={`nav-link ${isActive('/admin/audit-logs') ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>Audit Logs</Link>
              </>
            )}

            {user.role === 'pm' && (
              <>
                <Link to="/manager/clients" className={`nav-link ${isActive('/manager/clients') ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>My Clients</Link>
                <Link to="/manager/employees" className={`nav-link ${isActive('/manager/employees') ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>My Employees</Link>
              </>
            )}
          </div>

          <div className="navbar-stats">
            <span className="stat-pill">{stats.total} Total</span>
            <span className="stat-pill stat-new">{stats.New || 0} New</span>
            <span className="stat-pill stat-assigned">{stats.Assigned || 0} Assigned</span>
            <span className="stat-pill stat-progress">{stats['In Progress'] || 0} Active</span>
            <span className="stat-pill stat-closed">{stats.Closed || 0} Closed</span>
          </div>

          <div className="navbar-user">
            <div className="user-info">
              <div className="user-avatar">{initial}</div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-role badge">{user.role}</span>
              </div>
            </div>
            <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
