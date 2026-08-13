import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated && user && !user.mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  if (isAuthenticated && user && user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await login(email, password);
    if (!result.success) {
      setError(result.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    } else if (result.mustChangePassword) {
      navigate('/change-password');
    }
  };

  const autofill = (e, p) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="login-page">
      <div className="login-container animate-slide-up">
        <div className="login-header">
          <h1 className="login-title">Multiplier AI </h1>
          <p className="login-subtitle">Project Management  Dashboard</p>
        </div>

        <div className="card login-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address<span class="required">*</span></label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password<span class="required">*</span></label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button 
              type="submit" 
              className="btn btn-primary login-btn" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="demo-credentials">
          <h3>Demo Credentials</h3>
          <ul className="demo-list">
            <li onClick={() => autofill('alice@demo.com', 'password')}>
              <span className="demo-email">alice@demo.com / password</span>
              <span className="demo-role badge">Admin</span>
            </li>
            <li onClick={() => autofill('pete@demo.com', 'password')}>
              <span className="demo-email">pete@demo.com / password</span>
              <span className="demo-role badge">PM</span>
            </li>
            <li onClick={() => autofill('eve@demo.com', 'password')}>
              <span className="demo-email">eve@demo.com / password</span>
              <span className="demo-role badge">Employee</span>
            </li>
            <li onClick={() => autofill('dan@demo.com', 'password')}>
              <span className="demo-email">dan@demo.com / password</span>
              <span className="demo-role badge">Employee</span>
            </li>
            <li onClick={() => autofill('charlie@demo.com', 'password')}>
              <span className="demo-email">charlie@demo.com / password</span>
              <span className="demo-role badge">Client</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
