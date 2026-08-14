import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import './TicketFilters.css';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(monthValue) {
  if (!monthValue) return 31;
  const [year, month] = monthValue.split('-').map(Number);
  return new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
}

function getMaxSelectableDay(monthValue) {
  const daysInMonth = getDaysInMonth(monthValue);
  const now = new Date();
  const currentMonthValue = getCurrentMonth();

  if (monthValue === currentMonthValue) {
    return now.getDate(); // cap at today if viewing the current month
  }
  return daysInMonth; // past months: all days selectable
}

export default function TicketFilters({ onFilterChange }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [date, setDate] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  const [employees, setEmployees] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [clientId, setClientId] = useState('');
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);

  const showAssigneeFilter = user?.role === 'admin' || user?.role === 'pm';
  // Every role has a project filter, but each sources its options differently
  // (client: own projects, pm/admin: managed/all projects, employee: projects
  // derived from their assigned tickets) — see the effect below.
  const showProjectFilter = !!user?.role;
  const showClientFilter = user?.role === 'admin' || user?.role === 'pm';
  const maxSelectableDay = useMemo(() => getMaxSelectableDay(month), [month]);

  useEffect(() => {
    if (showAssigneeFilter) {
      apiFetch('/users?role=employee')
        .then(data => setEmployees(data.users || data))
        .catch(err => console.error('Failed to load employees', err));
    }
  }, [showAssigneeFilter]);

  useEffect(() => {
    if (!user?.role) return;

    if (user.role === 'client') {
      apiFetch('/clients/me/projects')
        .then(data => setProjects(data || []))
        .catch(err => console.error('Failed to load projects', err));
    } else if (user.role === 'pm' || user.role === 'admin') {
      apiFetch('/clients/projects')
        .then(data => setProjects(data || []))
        .catch(err => console.error('Failed to load projects', err));
      apiFetch('/clients')
        .then(data => setClients(data.clients || data))
        .catch(err => console.error('Failed to load clients', err));
    } else if (user.role === 'employee') {
      apiFetch('/tickets/projects/mine')
        .then(data => setProjects(data || []))
        .catch(err => console.error('Failed to load projects', err));
    }
  }, [user?.role]);

  useEffect(() => {
    if (day && Number(day) > maxSelectableDay) {
      setDay('');
      setDate('');
      emitFilters({ date: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSelectableDay]);

  const emitFilters = (overrides = {}) => {
    const next = { search, status, assignee, priority, date, month, projectId, clientId, ...overrides };
    onFilterChange(next);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    emitFilters({ search: val });
  };

  const handleStatusChange = (e) => {
    const val = e.target.value;
    setStatus(val);
    emitFilters({ status: val });
  };

  const handleAssigneeChange = (e) => {
    const val = e.target.value;
    setAssignee(val);
    emitFilters({ assignee: val });
  };

  const handlePriorityChange = (e) => {
    const val = e.target.value;
    setPriority(val);
    emitFilters({ priority: val });
  };

  const handleMonthChange = (e) => {
    const val = e.target.value;
    setMonth(val);
    setDay('');
    setDate('');
    emitFilters({ month: val, date: '' });
  };

  const handleDayChange = (e) => {
    const val = e.target.value;
    setDay(val);
    if (val && month) {
      const isoDate = `${month}-${String(val).padStart(2, '0')}`;
      setDate(isoDate);
      emitFilters({ date: isoDate, month });
    } else {
      setDate('');
      emitFilters({ date: '', month });
    }
  };

  const handleProjectChange = (e) => {
    const val = e.target.value;
    setProjectId(val);
    emitFilters({ projectId: val });
  };

  const handleClientChange = (e) => {
    const val = e.target.value;
    setClientId(val);
    emitFilters({ clientId: val });
  };

  return (
    <div className="ticket-filters">
      <div className="filter-group filter-group-search">
        <label className="filter-label" htmlFor="titleSearch">Search</label>
        <input
          id="titleSearch"
          type="text"
          className="filter-control"
          placeholder="Search by title"
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="dayFilter">Date</label>
        <select
          id="dayFilter"
          className="filter-control"
          value={day}
          onChange={handleDayChange}
          disabled={!month}
        >
          <option value="">Any date</option>
          {Array.from({ length: maxSelectableDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="monthFilter">Month</label>
        <input 
          id="monthFilter" 
          type="month" 
          className="filter-control" 
          value={month} 
          max={getCurrentMonth()}
          onChange={handleMonthChange}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="statusFilter">Status</label>
        <select 
          id="statusFilter" 
          className="filter-control" 
          value={status} 
          onChange={handleStatusChange}
        >
          <option value="">All</option>
          <option value="New">New</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Closed">Closed</option>
          <option value="Reopened">Reopened</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="priorityFilter">Priority</label>
        <select 
          id="priorityFilter" 
          className="filter-control" 
          value={priority} 
          onChange={handlePriorityChange}
        >
          <option value="">All</option>
          <option value="P1">P1 - Emergency (4 hours)</option>
          <option value="P2">P2 - High (8 hours)</option>
          <option value="P3">P3 - Medium (48 hours)</option>
          <option value="P4">P4 - Low (5 days)</option>
        </select>
      </div>

      {showProjectFilter && (
        <div className="filter-group">
          <label className="filter-label" htmlFor="projectFilter">Project</label>
          <select
            id="projectFilter"
            className="filter-control"
            value={projectId}
            onChange={handleProjectChange}
          >
            <option value="">All projects</option>
            {projects.map(proj => (
              <option key={proj._id} value={proj._id}>{proj.name}</option>
            ))}
          </select>
        </div>
      )}

      {showClientFilter && (
        <div className="filter-group">
          <label className="filter-label" htmlFor="clientFilter">Client</label>
          <select
            id="clientFilter"
            className="filter-control"
            value={clientId}
            onChange={handleClientChange}
          >
            <option value="">All clients</option>
            {clients.map(cl => (
              <option key={cl._id} value={cl._id}>{cl.name}</option>
            ))}
          </select>
        </div>
      )}

      {showAssigneeFilter && (
        <div className="filter-group">
          <label className="filter-label" htmlFor="assigneeFilter">Assignee</label>
          <select 
            id="assigneeFilter" 
            className="filter-control" 
            value={assignee} 
            onChange={handleAssigneeChange}
          >
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>{emp.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}