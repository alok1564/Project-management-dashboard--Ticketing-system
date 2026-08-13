import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

export default function PMClientListPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/clients')
      .then(data => setClients(data.clients || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container management-page animate-fade-in">
      <h1 className="page-title" style={{ marginBottom: 'var(--space-lg)' }}>My Clients</h1>

      <div className="card">
        {loading ? <div className="loading-spinner"></div> : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Project</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c._id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-secondary">{c.profile?.companyName || '—'}</td>
                    <td>{c.profile?.projectId?.name || '—'}</td>
                    <td><span className={`badge ${c.status === 'active' ? 'status-active' : 'status-inactive'}`}>{c.status}</span></td>
                  </tr>
                ))}
                {clients.length === 0 && <tr><td colSpan="4" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No clients assigned to you</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
