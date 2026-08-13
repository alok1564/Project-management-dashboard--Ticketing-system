import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import './AdminPage.css';

export default function AdminPage() {
  const [userStats, setUserStats] = useState({ total: 0, active: 0, pm: 0, employee: 0, client: 0 });
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0, unassigned: 0 });
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/users?limit=1000').then(d => {
        const users = d.users || d;
        setUserStats({
          total: users.length,
          active: users.filter(u => u.status === 'active').length,
          pm: users.filter(u => u.role === 'pm').length,
          employee: users.filter(u => u.role === 'employee').length,
          client: users.filter(u => u.role === 'client').length
        });
      }),
      apiFetch('/tickets?limit=1000').then(d => {
        const tickets = Array.isArray(d) ? d : (d.tickets || []);
        setTicketStats({
          total: tickets.length,
          open: tickets.filter(t => t.status !== 'Closed').length,
          unassigned: tickets.filter(t => !t.assignee).length
        });
      }),
      apiFetch('/projects').then(d => {
        const projects = Array.isArray(d) ? d : (d.projects || []);
        setProjectCount(projects.length);
      }).catch(() => setProjectCount(0))
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"></div>;

  return (
    <div className="container admin-page animate-fade-in">
      <h1 className="page-title mb-lg">Admin Overview</h1>

      <div className="stat-cards">
        <div className="stat-card"><span className="stat-card-value">{userStats.total}</span><span className="stat-card-label">Total Users</span></div>
        <div className="stat-card"><span className="stat-card-value">{userStats.active}</span><span className="stat-card-label">Active Users</span></div>
        <div className="stat-card"><span className="stat-card-value">{userStats.pm}</span><span className="stat-card-label">Project Managers</span></div>
        <div className="stat-card"><span className="stat-card-value">{userStats.employee}</span><span className="stat-card-label">Employees</span></div>
        <div className="stat-card"><span className="stat-card-value">{userStats.client}</span><span className="stat-card-label">Clients</span></div>
        <div className="stat-card"><span className="stat-card-value">{projectCount}</span><span className="stat-card-label">Active Projects</span></div>
        <div className="stat-card"><span className="stat-card-value">{ticketStats.open}</span><span className="stat-card-label">Open Tickets</span></div>
        <div className="stat-card"><span className="stat-card-value">{ticketStats.unassigned}</span><span className="stat-card-label">Unassigned Tickets</span></div>
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
        <Link to="/admin/users" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>👥</div>
          <div className="font-medium">Manage Users</div>
        </Link>
        <Link to="/admin/clients" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>🏢</div>
          <div className="font-medium">Manage Clients</div>
        </Link>
        <Link to="/admin/users/new" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>➕</div>
          <div className="font-medium">Create User</div>
        </Link>
        <Link to="/admin/audit-logs" className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)', cursor: 'pointer' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>📝</div>
          <div className="font-medium">Audit Logs</div>
        </Link>
      </div>
    </div>
  );
}
