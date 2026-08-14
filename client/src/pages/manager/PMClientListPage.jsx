import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/api';

export default function PMClientListPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/clients')
      .then(data => setClients(data.clients || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // A client may have projects managed by several different PMs — this page
  // should only ever show the ones that belong to the logged-in PM.
  const myProjectsFor = (client) => {
    if (!user?.id) return [];
    const projectIds = client.profile?.projectIds || [];
    return projectIds.filter(p => p.managerId && String(p.managerId._id) === String(user.id));
  };

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
                {clients.map(c => {
                  const myProjects = myProjectsFor(c);
                  return (
                    <tr key={c._id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-secondary">{c.profile?.companyName || '—'}</td>
                      <td>
                        {myProjects.length
                          ? myProjects.map(p => p.name).join(', ')
                          : '—'}
                      </td>
                      <td><span className={`badge ${c.status === 'active' ? 'status-active' : 'status-inactive'}`}>{c.status}</span></td>
                    </tr>
                  );
                })}
                {clients.length === 0 && <tr><td colSpan="4" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No clients assigned to you</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}