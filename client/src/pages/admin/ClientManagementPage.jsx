import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function ClientManagementPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pms, setPms] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchClients();
    apiFetch('/users?role=pm&status=active&limit=100').then(d => setPms(d.users || d)).catch(console.error);
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const data = await apiFetch(`/clients?${params.toString()}`);
      setClients(data.clients || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReassignPM = async (clientId, newPMId) => {
    try {
      await apiFetch(`/clients/${clientId}/manager`, { method: 'PATCH', body: { managerId: newPMId } });
      showToast('PM reassigned successfully', 'success');
      fetchClients();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="container management-page animate-fade-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="management-header">
        <h1 className="page-title">Client Management</h1>
        <Link to="/admin/users/new" className="btn btn-primary">+ Create Client</Link>
      </div>

      <div className="card">
        {loading ? <div className="loading-spinner"></div> : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Project</th>
                  <th>Project Manager</th>
                  <th>Status</th>
                  <th>Reassign PM</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c._id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-secondary">{c.profile?.companyName || '—'}</td>
                    <td>{c.profile?.projectId?.name || '—'}</td>
                    <td>{c.profile?.managerId?.name || <span style={{ color: 'var(--color-danger)' }}>Unassigned</span>}</td>
                    <td><span className={`badge ${c.status === 'active' ? 'status-active' : 'status-inactive'}`}>{c.status}</span></td>
                    <td>
                      <select
                        className="filter-control"
                        style={{ minWidth: '140px' }}
                        value={c.profile?.managerId?._id || ''}
                        onChange={e => handleReassignPM(c._id, e.target.value)}
                      >
                        <option value="">Select PM<span class="required">*</span></option>
                        {pms.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && <tr><td colSpan="6" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No clients found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
