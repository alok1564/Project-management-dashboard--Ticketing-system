import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function ClientManagementPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pms, setPms] = useState([]);
  const [toast, setToast] = useState(null);

  const [expandedClientId, setExpandedClientId] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectManagerId, setNewProjectManagerId] = useState('');
  const [addingProject, setAddingProject] = useState(false);

  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingProject, setSavingProject] = useState(false);

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

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleExpand = async (clientId) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      setClientDetail(null);
      return;
    }
    setExpandedClientId(clientId);
    setEditingProjectId(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectManagerId('');
    await loadClientDetail(clientId);
  };

  const loadClientDetail = async (clientId) => {
    setDetailLoading(true);
    try {
      const data = await apiFetch(`/users/${clientId}`);
      setClientDetail(data);
    } catch (err) {
      showToast(err.message || 'Failed to load client projects', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReassignPM = async (clientId, projectId, newPMId) => {
    if (!newPMId) return;
    try {
      await apiFetch(`/clients/${clientId}/manager`, {
        method: 'PATCH',
        body: { managerId: newPMId, projectId }
      });
      showToast('PM reassigned successfully', 'success');
      await loadClientDetail(clientId);
      fetchClients();
    } catch (err) {
      showToast(err.message || 'Failed to reassign PM', 'error');
    }
  };

  const handleStatusChange = async (clientId, projectId, status) => {
    try {
      await apiFetch(`/users/${clientId}/projects/${projectId}`, {
        method: 'PATCH',
        body: { status }
      });
      showToast('Project status updated', 'success');
      await loadClientDetail(clientId);
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const startEditProject = (project) => {
    setEditingProjectId(project._id);
    setEditName(project.name);
    setEditDescription(project.description || '');
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEditProject = async (clientId, projectId) => {
    if (!editName.trim()) {
      showToast('Project name is required', 'error');
      return;
    }
    setSavingProject(true);
    try {
      await apiFetch(`/users/${clientId}/projects/${projectId}`, {
        method: 'PATCH',
        body: { projectName: editName, projectDescription: editDescription }
      });
      showToast('Project updated successfully', 'success');
      cancelEditProject();
      await loadClientDetail(clientId);
    } catch (err) {
      showToast(err.message || 'Failed to update project', 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const handleRemoveProject = async (clientId, projectId) => {
    if (!window.confirm('Remove this project? This cannot be undone.')) return;
    try {
      await apiFetch(`/users/${clientId}/projects/${projectId}`, { method: 'DELETE' });
      showToast('Project removed successfully', 'success');
      await loadClientDetail(clientId);
      fetchClients();
    } catch (err) {
      showToast(err.message || 'Failed to remove project', 'error');
    }
  };

  const handleAddProject = async (clientId) => {
    if (!newProjectName.trim()) {
      showToast('Project name is required', 'error');
      return;
    }
    if (!newProjectManagerId) {
      showToast('Please select a PM for the new project', 'error');
      return;
    }
    setAddingProject(true);
    try {
      await apiFetch(`/users/${clientId}/projects`, {
        method: 'POST',
        body: {
          projectName: newProjectName,
          projectDescription: newProjectDescription,
          managerId: newProjectManagerId
        }
      });
      showToast('Project added successfully', 'success');
      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectManagerId('');
      await loadClientDetail(clientId);
      fetchClients();
    } catch (err) {
      showToast(err.message || 'Failed to add project', 'error');
    } finally {
      setAddingProject(false);
    }
  };

  const projects = clientDetail?.profile?.projectIds || [];

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
                  <th>Projects</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <React.Fragment key={c._id}>
                    <tr>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-secondary">{c.profile?.companyName || '—'}</td>
                      <td>{c.profile?.projectIds?.length || 0}</td>
                      <td><span className={`badge ${c.status === 'active' ? 'status-active' : 'status-inactive'}`}>{c.status}</span></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleExpand(c._id)}
                        >
                          {expandedClientId === c._id ? 'Close' : 'Manage Projects'}
                        </button>
                      </td>
                    </tr>
                    {expandedClientId === c._id && (
                      <tr>
                        <td colSpan="5" style={{ backgroundColor: 'var(--color-bg)', padding: 'var(--space-md)' }}>
                          {detailLoading ? (
                            <div className="loading-spinner"></div>
                          ) : (
                            <div>
                              {projects.length === 0 && (
                                <p className="text-secondary" style={{ marginBottom: 'var(--space-md)' }}>No projects yet.</p>
                              )}

                              {projects.map(project => (
                                <div
                                  key={project._id}
                                  className="card"
                                  style={{ marginBottom: 'var(--space-sm)', padding: 'var(--space-md)' }}
                                >
                                  {editingProjectId === project._id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                      <input
                                        className="form-control"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Project name"
                                      />
                                      <textarea
                                        className="form-control"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        placeholder="Project description"
                                        rows="2"
                                      />
                                      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          onClick={() => saveEditProject(c._id, project._id)}
                                          disabled={savingProject}
                                        >
                                          {savingProject ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          onClick={cancelEditProject}
                                          disabled={savingProject}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                                      <div>
                                        <div className="font-medium">{project.name}</div>
                                        {project.description && (
                                          <div className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '2px' }}>{project.description}</div>
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <select
                                          className="filter-control"
                                          value={project.status}
                                          onChange={(e) => handleStatusChange(c._id, project._id, e.target.value)}
                                        >
                                          <option value="active">Active</option>
                                          <option value="on-hold">On Hold</option>
                                          <option value="completed">Completed</option>
                                        </select>

                                        <select
                                          className="filter-control"
                                          style={{ minWidth: '140px' }}
                                          value={project.managerId?._id || ''}
                                          onChange={(e) => handleReassignPM(c._id, project._id, e.target.value)}
                                        >
                                          <option value="">Select PM</option>
                                          {pms.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                        </select>

                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => startEditProject(project)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          style={{ color: 'var(--status-closed)' }}
                                          onClick={() => handleRemoveProject(c._id, project._id)}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}

                              <div className="card" style={{ padding: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="font-medium" style={{ marginBottom: 'var(--space-sm)' }}>Add New Project</div>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                  <input
                                    className="form-control"
                                    style={{ flex: '1 1 180px' }}
                                    placeholder="Project name"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                  />
                                  <input
                                    className="form-control"
                                    style={{ flex: '1 1 220px' }}
                                    placeholder="Description (optional)"
                                    value={newProjectDescription}
                                    onChange={(e) => setNewProjectDescription(e.target.value)}
                                  />
                                  <select
                                    className="filter-control"
                                    style={{ minWidth: '140px' }}
                                    value={newProjectManagerId}
                                    onChange={(e) => setNewProjectManagerId(e.target.value)}
                                  >
                                    <option value="">Select PM</option>
                                    {pms.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                  </select>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleAddProject(c._id)}
                                    disabled={addingProject}
                                  >
                                    {addingProject ? 'Adding...' : 'Add Project'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {clients.length === 0 && <tr><td colSpan="5" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No clients found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}