import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import TicketCard from '../components/TicketCard';
import TicketFilters from '../components/TicketFilters';
import './DashboardPage.css';

function filterTickets(tickets, filters) {
  return tickets.filter(ticket => {
    if (filters.search && !ticket.title?.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.priority && ticket.priority !== filters.priority) {
      return false;
    }

    const created = new Date(ticket.createdAt);

    if (filters.date) {
      const filterDate = new Date(filters.date);
      return (
        created.getFullYear() === filterDate.getFullYear() &&
        created.getMonth() === filterDate.getMonth() &&
        created.getDate() === filterDate.getDate()
      );
    }

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

function getSubtitle(role) {
  switch (role) {
    case 'client':
      return "Track your tickets and see what's being worked on.";
    case 'employee':
      return "Here's what's on your plate today.";
    case 'pm':
      return "Here's how your team's tickets are moving.";
    case 'admin':
      return "Here's an overview of activity across the platform.";
    default:
      return "Here's your project status.";
  }
}
function getwelcome(role) {
  switch (role) {
    case 'client':
      return "Welcome";
    case 'employee':
      return "Good to see you .";
    case 'pm':
      return "Good to see you .";
    case 'admin':
      return "Good to see you ";
    default:
      return "Hey there .";
  }
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
    search: '',
    month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.status) query.append('status', filters.status);
      if (filters.assignee) query.append('assignee', filters.assignee);

      const data = await apiFetch(`/tickets?${query.toString()}`);
      // Handle both old format (array) and new format (paginated object)
      const tickets = Array.isArray(data) ? data : (data.tickets || []);
      setAllTickets(tickets);
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filters.status, filters.assignee]);

  const displayedTickets = filterTickets(allTickets, filters);

  return (
    <div className="container dashboard-page animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{getwelcome(user.role)}, {user.name}</h1>
          <p className="dashboard-subtitle">{getSubtitle(user.role)}</p>
        </div>

        {user.role === 'client' && (
          <Link to="/tickets/new" className="btn btn-primary">+ New Ticket</Link>
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