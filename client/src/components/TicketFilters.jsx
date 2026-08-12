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
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [date, setDate] = useState(''); // full ISO date, e.g. "2026-08-11", derived from month + day
  const [day, setDay] = useState('');   // just the day-of-month number, e.g. "11"
  const [month, setMonth] = useState(getCurrentMonth());
  const [employees, setEmployees] = useState([]);

  const showAssigneeFilter = user?.role === 'admin' || user?.role === 'pm';
  const maxSelectableDay = useMemo(() => getMaxSelectableDay(month), [month]);

  useEffect(() => {
    if (showAssigneeFilter) {
      apiFetch('/users?role=employee')
        .then(data => setEmployees(data))
        .catch(err => console.error('Failed to load employees', err));
    }
  }, [showAssigneeFilter]);

  // If the selected day is no longer valid for the current month
  // (e.g. day 31 selected, then month changed to February, or today's
  // date moved backward relative to a previously selected future day),
  // clear it.
  useEffect(() => {
    if (day && Number(day) > maxSelectableDay) {
      setDay('');
      setDate('');
      emitFilters({ date: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSelectableDay]);

  const emitFilters = (overrides = {}) => {
    const next = { status, assignee, priority, date, month, ...overrides };
    onFilterChange(next);
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

  return (
    <div className="ticket-filters">
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
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

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
    </div>
  );
}