import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './SignupPage.css';

const ROLES = [
  { value: 'client', label: 'Client', icon: '👤', desc: 'Raise support tickets for your projects' },
  { value: 'employee', label: 'Employee', icon: '👨‍💻', desc: 'Work on tickets assigned to you' },
  { value: 'pm', label: 'Project Manager', icon: '📋', desc: 'Manage and assign tickets to your team' },
  { value: 'admin', label: 'Admin', icon: '🛡️', desc: 'Full access to all tickets, users, and settings' },
];

export default function SignupPage() {
  const { signup, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password || !role) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await signup(name.trim(), email.trim(), password, role);
    if (!result.success) {
      setError(result.message || 'Signup failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container animate-slide-up">
        <div className="login-header">
          <div className="login-logo">🎫</div>
          <h1 className="login-title">Join Multiplier</h1>
          <p className="login-subtitle">Create your account to get started</p>
        </div>

        <div className="card login-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
                <input
                  id="signup-confirm"
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Your Role</label>
              <div className="role-grid">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`role-card ${role === r.value ? 'selected' : ''}`}
                    onClick={() => setRole(r.value)}
                  >
                    <span className="role-icon">{r.icon}</span>
                    <span className="role-label">{r.label}</span>
                    <span className="role-desc">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button 
              type="submit" 
              className="btn btn-primary login-btn" 
              disabled={loading || !role}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="signup-footer">
          <p>Already have an account? <Link to="/login" className="signup-link">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
