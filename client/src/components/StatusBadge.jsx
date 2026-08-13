import React from 'react';

export default function StatusBadge({ status }) {
  let bgColor = 'var(--status-new-bg)';
  let color = 'var(--status-new)';

  switch (status?.toLowerCase()) {
    case 'assigned':
      bgColor = 'var(--status-assigned-bg)';
      color = 'var(--status-assigned)';
      break;
    case 'in progress':
      bgColor = 'var(--status-in-progress-bg)';
      color = 'var(--status-in-progress)';
      break;
    case 'waiting for client':
      bgColor = 'var(--status-waiting-bg)';
      color = 'var(--status-waiting)';
      break;
    case 'resolved':
      bgColor = 'var(--status-resolved-bg)';
      color = 'var(--status-resolved)';
      break;
    case 'closed':
      bgColor = 'var(--status-closed-bg)';
      color = 'var(--status-closed)';
      break;
    case 'reopened':
      bgColor = 'var(--status-reopened-bg)';
      color = 'var(--status-reopened)';
      break;
    case 'new':
    default:
      bgColor = 'var(--status-new-bg)';
      color = 'var(--status-new)';
      break;
  }

  return (
    <span 
      className="badge" 
      style={{ 
        backgroundColor: bgColor, 
        color: color 
      }}
    >
      {status || 'New'}
    </span>
  );
}
