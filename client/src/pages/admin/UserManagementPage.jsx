import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [toast, setToast] = useState(null);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);
      params.append('page', page);
      params.append('limit', '20');

      const data = await apiFetch(`/users?${params.toString()}`);
      setUsers(data.users || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  // Single debounced effect: fires on any filter change (role, status, search).
  // Debouncing all of them together avoids the double-fetch-on-mount issue
  // and keeps typing smooth since role/status changes are infrequent anyway.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter, search]);

  const toggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await apiFetch(`/users/${userId}/status`, {
        method: 'PATCH',
        body: { status: newStatus }
      });
      showToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchUsers(pagination.page);
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
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
        <h1 className="page-title">User Management</h1>
        <Link to="/admin/users/new" className="btn btn-primary">+ Create User</Link>
      </div>

      <div className="management-filters">
        <div className="filter-group">
          <label className="filter-label">Role</label>
          <select className="filter-control" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="pm">Project Manager</option>
            <option value="employee">Employee</option>
            <option value="client">Client</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select className="filter-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Search</label>
          <input
            type="text"
            className="filter-control"
            placeholder="Name or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td className="font-medium">
                        <Link to={`/admin/users/${u._id}`} style={{ color: 'var(--color-primary)' }}>{u.name}</Link>
                      </td>
                      <td className="text-secondary">{u.email}</td>
                      <td><span className="badge">{u.role}</span></td>
                      <td>
                        <span className={`badge ${u.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleStatus(u._id, u.status || 'active')}
                          style={{ color: u.status === 'active' ? 'var(--color-danger)' : 'var(--color-success)' }}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan="5" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pagination.pages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}>← Prev</button>
                <span className="pagination-info">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
                <button className="pagination-btn" disabled={pagination.page >= pagination.pages} onClick={() => fetchUsers(pagination.page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}