import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Temp@1234');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [managerId, setManagerId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [pms, setPms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/users?role=pm&status=active&limit=100')
      .then(d => setPms(d.users || d))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!role || !name || !email || !password) {
      setError('Name, email, role, and password are required.');
      return;
    }
    if (role === 'client' && !managerId) {
      setError('A Project Manager must be selected for clients.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: { name, email, password, role, phone, designation, department, companyName, address, managerId, projectName, projectDescription }
      });
      navigate('/admin/users');
    } catch (err) {
      setError(err.message || 'Failed to create user.');
      setLoading(false);
    }
  };

  return (
    <div className="container management-page animate-slide-up" style={{ maxWidth: '700px' }}>
      <Link to="/admin/users" className="back-link">← Back to Users</Link>
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>Create User</h1>

      <div className="card form-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Role <span class="required">*</span></label>
            <select className="form-control" value={role} onChange={e => setRole(e.target.value)} required>
              <option value="">Select Role</option>
              <option value="pm">Project Manager</option>
              <option value="employee">Employee</option>
              <option value="client">Client</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Full Name <span class="required">*</span></label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email <span class="required">*</span></label>
              <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Temporary Password <span class="required">*</span></label>
              <input className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {(role === 'pm' || role === 'employee') && (
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
          )}

          {role === 'employee' && (
            <div className="form-group">
              <label className="form-label">Assign to Project Manager</label>
              <select className="form-control" value={managerId} onChange={e => setManagerId(e.target.value)}>
                <option value="">Select PM (optional)</option>
                {pms.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {role === 'client' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-control" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign Project Manager <span class="required">*</span></label>
                  <select className="form-control" value={managerId} onChange={e => setManagerId(e.target.value)} required>
                    <option value="">Select PM</option>
                    {pms.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-control" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Project Name<span class="required">*</span></label>
                  <input className="form-control" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Enter the project name " />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Description</label>
                  <input className="form-control" value={projectDescription} onChange={e => setProjectDescription(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            <Link to="/admin/users" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
