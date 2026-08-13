import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import './NewTicketPage.css';

export default function NewTicketPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await apiFetch('/tickets', {
        method: 'POST',
        body: { title, description, priority }
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
            <label className="form-label" htmlFor="title">Ticket Title<span class="required">*</span></label>
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
            <label className="form-label" htmlFor="description">Description<span class="required">*</span></label>
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
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}