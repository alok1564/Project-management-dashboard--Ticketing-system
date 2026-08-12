import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import './TicketCard.css';

function formatTimestamp(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    return hours + 'h ago';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

export default function TicketCard({ ticket }) {
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'p1': return { bg: 'var(--priority-p1-bg)', text: 'var(--priority-p1)' };
      case 'p2': return { bg: 'var(--priority-p2-bg)', text: 'var(--priority-p2)' };
      case 'p3': return { bg: 'var(--priority-p3-bg)', text: 'var(--priority-p3)' };
      case 'p4': return { bg: 'var(--priority-p4-bg)', text: 'var(--priority-p4)' };
      default: return { bg: 'var(--color-border-light)', text: 'var(--color-text-secondary)' };
    }
  };

  const priorityStyle = getPriorityColor(ticket.priority);

  return (
    <Link to={`/tickets/${ticket._id}`} className="card ticket-card">
      <div className="ticket-header">
        <h3 className="ticket-title">{ticket.title}</h3>
        <div className="ticket-badges">
          <StatusBadge status={ticket.status} />
          <span 
            className="badge" 
            style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.text }}
          >
            {ticket.priority}
          </span>
        </div>
      </div>
      
      <div className="ticket-body">
        <div className="ticket-meta-group">
          <span className="meta-label">Raised by</span>
          <span className="badge name-badge requester-badge">{ticket.requester?.name || 'Unknown'}</span>
        </div>
        <div className="ticket-meta-group">
          <span className="meta-label">Assigned to</span>
          <span className={`badge name-badge ${ticket.assignee ? 'assignee-badge' : 'unassigned-badge'}`}>
            {ticket.assignee?.name || 'Unassigned'}
          </span>
        </div>
        {ticket.assignedBy && (
          <div className="ticket-meta-group">
            <span className="meta-label">Managed by</span>
            <span className="badge name-badge pm-badge">{ticket.assignedBy.name}</span>
          </div>
        )}
      </div>
      
      <div className="ticket-footer">
        <span className="ticket-time">Created {formatTimestamp(ticket.createdAt)}</span>
        <span className="ticket-time">Updated {formatTimestamp(ticket.lastActivity)}</span>
      </div>
    </Link>
  );
}