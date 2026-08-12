import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import TicketCard from '../components/TicketCard';
import TicketFilters from '../components/TicketFilters';
import './DashboardPage.css';

function filterByDateRange(tickets, filters) {
  return tickets.filter(ticket => {
    const created = new Date(ticket.createdAt);

    // Priority filter
    if (filters.priority && ticket.priority !== filters.priority) {
      return false;
    }

    // Specific date filter (overrides month)
    if (filters.date) {
      const filterDate = new Date(filters.date);
      return (
        created.getFullYear() === filterDate.getFullYear() &&
        created.getMonth() === filterDate.getMonth() &&
        created.getDate() === filterDate.getDate()
      );
    }

    // Month filter
    if (filters.month) {
      const [year, month] = filters.month.split('-').map(Number);
      return (
        created.getFullYear() === year &&
        created.getMonth() === month - 1
      );
    }

    return true;
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    assignee: '',
    priority: '',
    date: '',
    month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  });
  
  const fetchTickets = async () => {
    setLoading(true);
    try {
      // Only send status and assignee to the API (server-side filters)
      const query = new URLSearchParams();
      if (filters.status) query.append('status', filters.status);
      if (filters.assignee) query.append('assignee', filters.assignee);
      
      const data = await apiFetch(`/tickets?${query.toString()}`);
      setAllTickets(data);
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filters.status, filters.assignee]);

  // Apply client-side filters (priority, date, month)
  const displayedTickets = filterByDateRange(allTickets, filters);

  return (
    <div className="container dashboard-page animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Welcome back, {user.name}</h1>
          <p className="dashboard-subtitle">
            Here's your project status.
          </p>
        </div>
        
        {user.role === 'client' && (
          <Link to="/tickets/new" className="btn btn-primary">
            + New Ticket
          </Link>
        )}
      </div>

      <TicketFilters onFilterChange={setFilters} />

      <div className="tickets-container">
        {loading ? (
          <div className="loading-spinner"></div>
        ) : displayedTickets.length > 0 ? (
          <div className="ticket-list">
            {displayedTickets.map(ticket => (
              <TicketCard key={ticket._id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <div className="empty-icon">📭</div>
            <h3>No tickets found</h3>
            <p>Try adjusting your filters or create a new ticket.</p>
          </div>
        )}
      </div>
    </div>
  );
}
