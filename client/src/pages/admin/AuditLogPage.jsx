import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

function formatAction(action) {
  return (action || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '30');
      if (actionFilter) params.append('action', actionFilter);
      const data = await apiFetch(`/audit-logs?${params.toString()}`);
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [actionFilter]);

  return (
    <div className="container management-page animate-fade-in">
      <div className="management-header">
        <h1 className="page-title">Audit Logs</h1>
      </div>

      <div className="management-filters">
        <div className="filter-group">
          <label className="filter-label">Action</label>
          <select className="filter-control" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="user_created">User Created</option>
            <option value="user_activated">User Activated</option>
            <option value="user_deactivated">User Deactivated</option>
            <option value="employee_reassigned">Employee Reassigned</option>
            <option value="client_pm_reassigned">Client PM Reassigned</option>
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-spinner"></div> : (
          <>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log._id}>
                      <td className="text-secondary" style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="font-medium">{log.userId?.name || 'System'}</td>
                      <td><span className="badge">{formatAction(log.action)}</span></td>
                      <td className="text-secondary">{log.entityType}</td>
                      <td
                        className="text-secondary"
                        onClick={() => log.newValue && setSelectedLog(log)}
                        style={{
                          fontSize: '0.82rem',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: log.newValue ? 'pointer' : 'default',
                          textDecoration: log.newValue ? 'underline dotted' : 'none'
                        }}
                        title={log.newValue ? 'Click to view full details' : ''}
                      >
                        {log.newValue ? JSON.stringify(log.newValue).substring(0, 80) : '—'}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan="5" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No audit logs found</td></tr>}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)}>← Prev</button>
                <span className="pagination-info">Page {pagination.page} of {pagination.pages}</span>
                <button className="pagination-btn" disabled={pagination.page >= pagination.pages} onClick={() => fetchLogs(pagination.page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLog && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedLog(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-md)'
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '640px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.15))'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
              <div>
                <h3 style={{ margin: 0 }}>{formatAction(selectedLog.action)}</h3>
                <p className="text-secondary" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                  {new Date(selectedLog.timestamp).toLocaleString()} · {selectedLog.userId?.name || 'System'} · {selectedLog.entityType}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <pre
              style={{
                backgroundColor: 'var(--color-border-light)',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md, 8px)',
                fontSize: '0.82rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0
              }}
            >
              {JSON.stringify(selectedLog.newValue, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}