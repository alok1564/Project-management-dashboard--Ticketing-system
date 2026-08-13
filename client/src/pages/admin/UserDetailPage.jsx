import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function UserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pms, setPms] = useState([]);
  const [newManagerId, setNewManagerId] = useState('');
  const [toast, setToast] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUser();
    apiFetch('/users?role=pm&limit=100').then(d => setPms(d.users || d)).catch(console.error);
  }, [id]);

  const fetchUser = async () => {
    try {
      const result = await apiFetch(`/users/${id}`);
      setData(result);
      if (result.profile?.managerId) {
        setNewManagerId(typeof result.profile.managerId === 'object' ? result.profile.managerId._id : result.profile.managerId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!newManagerId) return;
    setUpdating(true);
    try {
      await apiFetch(`/users/${id}/manager`, { method: 'PATCH', body: { managerId: newManagerId } });
      showToast('Manager reassigned', 'success');
      fetchUser();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const toggleStatus = async () => {
    const newStatus = data.user.status === 'active' ? 'inactive' : 'active';
    try {
      await apiFetch(`/users/${id}/status`, { method: 'PATCH', body: { status: newStatus } });
      showToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
      fetchUser();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (!data) return <div className="container mt-4">User not found</div>;

  const { user, profile, createdBy } = data;

  return (
    <div className="container management-page animate-fade-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      <Link to="/admin/users" className="back-link">← Back to Users</Link>

      <div className="management-header">
        <h1 className="page-title">{user.name}</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <span className={`badge ${user.status === 'active' ? 'status-active' : 'status-inactive'}`}>{user.status}</span>
          <span className="badge">{user.role}</span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={toggleStatus}
            style={{ color: user.status === 'active' ? 'var(--color-danger)' : 'var(--color-success)' }}
          >
            {user.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>Account Info</h3>
          <div className="form-group"><span className="form-label">Email</span><div>{user.email}</div></div>
          <div className="form-group"><span className="form-label">Role</span><div><span className="badge">{user.role}</span></div></div>
          <div className="form-group"><span className="form-label">Created</span><div>{new Date(user.createdAt).toLocaleDateString()}</div></div>
          {createdBy && <div className="form-group"><span className="form-label">Created By</span><div>{createdBy.name} ({createdBy.role})</div></div>}
        </div>

        {profile && (
          <div className="card">
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Details</h3>
            {profile.phone && <div className="form-group"><span className="form-label">Phone</span><div>{profile.phone}</div></div>}
            {profile.designation && <div className="form-group"><span className="form-label">Designation</span><div>{profile.designation}</div></div>}
            {profile.department && <div className="form-group"><span className="form-label">Department</span><div>{profile.department}</div></div>}
            {profile.companyName && <div className="form-group"><span className="form-label">Company</span><div>{profile.companyName}</div></div>}
            {profile.address && <div className="form-group"><span className="form-label">Address</span><div>{profile.address}</div></div>}

            {profile.managerId && (
              <div className="form-group">
                <span className="form-label">Project Manager</span>
                <div>{typeof profile.managerId === 'object' ? profile.managerId.name : profile.managerId}</div>
              </div>
            )}

            {profile.projectId && (
              <div className="form-group">
                <span className="form-label">Project</span>
                <div>{typeof profile.projectId === 'object' ? profile.projectId.name : profile.projectId}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {(user.role === 'employee' || user.role === 'client') && (
        <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reassign Manager</h3>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <select className="form-control" value={newManagerId} onChange={e => setNewManagerId(e.target.value)}>
                <option value="">Select PM</option>
                {pms.filter(p => p.status === 'active').map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleReassign} disabled={updating || !newManagerId}>
              {updating ? 'Saving...' : 'Reassign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
