import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import './TicketDetailPage.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
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

  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatCommentTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);

  // Always show date + time together for comment/activity timestamps.
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function roleInitial(role) {
  const r = (role || '').toLowerCase();
  if (r === 'pm') return 'PM';
  return r.charAt(0).toUpperCase() || '?';
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [statusAction, setStatusAction] = useState(null); // null | 'close'
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenText, setReopenText] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchTicket();
    if (user.role === 'admin' || user.role === 'pm') {
      apiFetch('/users?role=employee').then(data => {
        const emps = data.users || data;
        setEmployees(Array.isArray(emps) ? emps.filter(u => u.role === 'employee') : []);
      }).catch(console.error);
    }
  }, [id, user.role]);

  // Show a "go to bottom" button whenever the end of the discussion thread
  // isn't currently in view — naturally stays hidden if the thread is short
  // enough that it's already visible without scrolling.
  useEffect(() => {
    const node = bottomRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollButton(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [comments.length, ticket]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const fetchTicket = async () => {
    try {
      const data = await apiFetch(`/tickets/${id}`);
      setTicket(data.ticket);
      setComments(data.comments || []);
      if (data.ticket.assignee) setAssigneeId(data.ticket.assignee._id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    setUpdatingAssignee(true);
    try {
      await apiFetch(`/tickets/${id}`, {
        method: 'PUT',
        body: { assignee: assigneeId }
      });
      await fetchTicket();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingAssignee(false);
    }
  };

  const handleStatusUpdate = async (newStatus, action) => {
    setStatusAction(action);
    try {
      await apiFetch(`/tickets/${id}`, {
        method: 'PUT',
        body: { status: newStatus }
      });
      await fetchTicket();
    } catch (err) {
      console.error(err);
    } finally {
      setStatusAction(null);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);

    try {
      const newComment = await apiFetch(`/tickets/${id}/comments`, {
        method: 'POST',
        body: { text: commentText }
      });
      setCommentText('');
      setComments(prev => [...prev, newComment]);
      // Also refresh ticket to update lastActivity
      const data = await apiFetch(`/tickets/${id}`);
      setTicket(data.ticket);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    submitComment();
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenText.trim()) return;
    setSubmittingReopen(true);

    try {
      const newComment = await apiFetch(`/tickets/${id}/comments`, {
        method: 'POST',
        body: { text: reopenText, reopen: true }
      });
      setReopenText('');
      setShowReopenForm(false);
      setComments(prev => [...prev, newComment]);
      // Refresh ticket — picks up the status flip to Reopened
      const data = await apiFetch(`/tickets/${id}`);
      setTicket(data.ticket);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReopen(false);
    }
  };

  if (loading) return <div className="loading-spinner"></div>;
  if (!ticket) return <div className="container mt-4">Ticket not found</div>;

  const isAssignedToMe = ticket.assignee && ticket.assignee._id === user.id;
  const canAssign = user.role === 'admin' || user.role === 'pm';
  const canUpdateStatusPM = user.role === 'admin' || user.role === 'pm';
  const requesterRole = (ticket.requester?.role || 'client').toLowerCase();
  const assigneeRole = (ticket.assignee?.role || 'employee').toLowerCase();
  const canReopen = user.role === 'client' && ticket.requester?._id === user.id && ticket.status === 'Closed';
  const canClose = ticket.status !== 'Closed' && (canUpdateStatusPM || isAssignedToMe);

  return (
    <div className="container ticket-detail-page animate-fade-in">
      <Link to="/" className="back-link">← Back to Dashboard</Link>

      <div className="detail-layout">
        {/* ===== Main column ===== */}
        <div className="detail-main">
          <div className="card detail-combined-card">
            <div className="detail-header">
              <h1 className="detail-title">{ticket.title}</h1>
              <div className="detail-badges">
                <StatusBadge status={ticket.status} />
                <span className="badge" style={{ backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }}>
                  {ticket.priority}
                </span>
              </div>
            </div>
            <div className="detail-description">
              {ticket.description}
            </div>

            <div className="comments-section-inner">
              {/* <div className="discussion-label">
                Discussion<span className="discussion-count">{comments.length}</span>
              </div> */}

              <ul className="timeline">
                {/* Opening event — remove this block if you don't want the "opened this ticket" line */}
                <li className="timeline-item timeline-event">
                  <div className={`comment-avatar avatar-${requesterRole}`}>
                    {roleInitial(requesterRole)}
                  </div>
                  <div className="timeline-event-text">
                    <span className="comment-author">{ticket.requester?.name || 'Unknown'}</span> opened this ticket
                    <span className="comment-time"> · {formatCommentTime(ticket.createdAt)}</span>
                  </div>
                </li>

                {comments.length > 0 ? (
                  comments.map((comment) => {
                    const role = (comment.author?.role || '').toLowerCase();

                    // System-generated activity entries (assign / close / auto-transition)
                    // render as a lightweight event line, same pattern as "opened this ticket".
                    if (comment.isActivity) {
                      return (
                        <li key={comment._id} className="timeline-item timeline-event">
                          <div className={`comment-avatar avatar-${role || 'client'}`}>
                            {roleInitial(role)}
                          </div>
                          <div className="timeline-event-text">
                            {comment.isSystem ? (
                              comment.text
                            ) : (
                              <>
                                <span className="comment-author">{comment.author?.name || 'Unknown'}</span> {comment.text}
                              </>
                            )}
                            <span className="comment-time"> · {formatCommentTime(comment.createdAt)}</span>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={comment._id} className="timeline-item">
                        <div className={`timeline-avatar avatar-${role || 'client'}`}>
                          {roleInitial(role)}
                        </div>
                        <div className={`comment-card${comment.isReopen ? ' comment-card-reopen' : ''}`}>
                          <div className="comment-card-header">
                            <div className="comment-card-header-left">
                              <span className="comment-author">{comment.author?.name || 'Unknown'}</span>
                              <span className="comment-verb">
                                {comment.isReopen ? 'reopened this ticket and commented' : 'commented'}
                              </span>
                              <span className="comment-time">{formatCommentTime(comment.createdAt)}</span>
                            </div>
                            <span className={`badge role-badge-${role || 'client'}`}>
                              {comment.author?.role || 'User'}
                            </span>
                          </div>
                          <div className="comment-card-body">{comment.text}</div>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="no-comments-row">
                    <p className="no-comments">No comments yet. Start the conversation!</p>
                  </li>
                )}
              </ul>

              {ticket.status !== 'Closed' && (
                <form onSubmit={handleAddComment} className="comment-form">
                  <textarea
                    className="form-control"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type your comment here..."
                    required
                    rows="3"
                  />
                  <div className="comment-form-actions">
                    <button type="submit" className="btn btn-primary" disabled={submittingComment}>
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        {/* ===== Sidebar (moves to bottom on mobile) ===== */}
        <aside className="detail-sidebar">
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Assignee</h4>
            {ticket.assignee ? (
              <div className="sidebar-person">
                <span className={`comment-avatar avatar-${assigneeRole}`}>{roleInitial(assigneeRole)}</span>
                <span>{ticket.assignee.name}</span>
              </div>
            ) : (
              <span className="sidebar-empty">Unassigned</span>
            )}
            {canAssign && (
              <div className="sidebar-controls">
                <select
                  className="form-control"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={updatingAssignee || ticket.status === 'Closed'}
                >
                  <option value="">Unassigned</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>{emp.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleAssign}
                  disabled={updatingAssignee || ticket.status === 'Closed'}
                >
                  {updatingAssignee ? <span className="spinner-sm" aria-label="Updating" /> : 'Update Assignee'}
                </button>
              </div>
            )}
          </div>

          {(canClose || canReopen) && (
            <div className="sidebar-section">
              <h4 className="sidebar-section-title">Status</h4>
              <div className="sidebar-controls">
                {canClose && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleStatusUpdate('Closed', 'close')}
                    disabled={statusAction !== null}
                    style={{ borderColor: 'var(--status-closed)', color: 'var(--status-closed)' }}
                  >
                    {statusAction === 'close' ? <span className="spinner-sm" aria-label="Updating" /> : 'Close Ticket'}
                  </button>
                )}

                {canReopen && !showReopenForm && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowReopenForm(true)}
                    style={{ borderColor: 'var(--status-reopened)', color: 'var(--status-reopened)' }}
                  >
                    Reopen Ticket
                  </button>
                )}

                {canReopen && showReopenForm && (
                  <form onSubmit={handleReopenSubmit} className="reopen-form">
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Let us know why you're reopening this ticket..."
                      value={reopenText}
                      onChange={(e) => setReopenText(e.target.value)}
                      required
                      autoFocus
                    />
                    <div className="reopen-form-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setShowReopenForm(false); setReopenText(''); }}
                        disabled={submittingReopen}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-sm"
                        disabled={submittingReopen}
                        style={{ backgroundColor: 'var(--status-reopened)', color: '#fff' }}
                      >
                        {submittingReopen ? 'Reopening...' : 'Reopen'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Reporter</h4>
            <div className="sidebar-person">
              <span className={`comment-avatar avatar-${requesterRole}`}>{roleInitial(requesterRole)}</span>
              <span>{ticket.requester?.name || 'Unknown'}</span>
            </div>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Assigned By</h4>
            <span className={ticket.assignedBy ? 'sidebar-value' : 'sidebar-empty'}>
              {ticket.assignedBy?.name || '—'}
            </span>
          </div>

          {ticket.managerId && (
            <div className="sidebar-section">
              <h4 className="sidebar-section-title">Project Manager</h4>
              <div className="sidebar-person">
                <span className="comment-avatar avatar-pm">{ticket.managerId.name ? ticket.managerId.name.charAt(0).toUpperCase() : 'P'}</span>
                <span>{ticket.managerId.name || '—'}</span>
              </div>
            </div>
          )}
          {ticket.projectId && (
            <div className="sidebar-section">
              <h4 className="sidebar-section-title">Project</h4>
              <span className="sidebar-value">{ticket.projectId.name || '—'}</span>
            </div>
          )}

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Created</h4>
            <span className="sidebar-value">{formatDate(ticket.createdAt)}</span>
          </div>

          <div className="sidebar-section sidebar-section-last">
            <h4 className="sidebar-section-title">Last Activity</h4>
            <span className="sidebar-value">{formatDate(ticket.lastActivity)}</span>
          </div>
        </aside>
      </div>

      {showScrollButton && (
        <button
          type="button"
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          aria-label="Go to bottom of discussion"
        >
          ↓ Bottom
        </button>
      )}
    </div>
  );
}