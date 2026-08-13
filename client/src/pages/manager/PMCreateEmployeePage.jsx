import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function PMCreateEmployeePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Temp@1234');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email) {
      setError('Name and email are required.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: { name, email, password, phone, designation, department, role: 'employee' }
      });
      navigate('/manager/employees');
    } catch (err) {
      setError(err.message || 'Failed to create employee.');
      setLoading(false);
    }
  };

  return (
    <div className="container management-page animate-slide-up" style={{ maxWidth: '600px' }}>
      <Link to="/manager/employees" className="back-link">← Back to Employees</Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Add Employee</h1>
      <p className="text-secondary" style={{ marginBottom: 'var(--space-lg)' }}>This employee will be automatically assigned to you.</p>

      <div className="card form-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input className="form-control" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-control" value={designation} onChange={e => setDesignation(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-control" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <Link to="/manager/employees" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
