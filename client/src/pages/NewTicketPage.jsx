import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import './NewTicketPage.css';

export default function NewTicketPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/clients/me/projects')
      .then((data) => {
        setProjects(data);
        if (data.length === 1) {
          setProjectId(data[0]._id); // auto-select when there's only one project
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load your projects. Please refresh and try again.');
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiFetch('/tickets', {
        method: 'POST',
        body: { title, description, priority, projectId }
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to create ticket.');
      setLoading(false);
    }
  };

  return (
    <div className="container new-ticket-page animate-slide-up">
      <div className="page-header">
        <Link to="/" className="back-link">← Back to Dashboard</Link>
        <h1 className="page-title">Raise a New Ticket</h1>
      </div>

      <div className="card form-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="project">Project<span className="required">*</span></label>
            <select
              id="project"
              className="form-control"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={loadingProjects || projects.length === 0}
              required
            >
              <option value="">
                {loadingProjects ? 'Loading projects...' : projects.length === 0 ? 'No projects available' : 'Select a project'}
              </option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name}{project.managerId?.name ? ` — PM: ${project.managerId.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="title">Ticket Title<span className="required">*</span></label>
            <input
              id="title"
              type="text"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description<span className="required">*</span></label>
            <textarea
              id="description"
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed explanation of what you need help with..."
              required
              rows="6"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="priority">Priority</label>
            <select
              id="priority"
              className="form-control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="P1">P1 - Emergency (4 hours)</option>
              <option value="P2">P2 - High (8 hours)</option>
              <option value="P3">P3 - Medium (48 hours)</option>
              <option value="P4">P4 - Low (5 days)</option>
            </select>
          </div>

          <div className="form-actions">
            <Link to="/" className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading || loadingProjects || projects.length === 0}>
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}