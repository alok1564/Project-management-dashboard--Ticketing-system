import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import TicketCard from '../components/TicketCard';
import TicketFilters from '../components/TicketFilters';
import './AdminPage.css';

function filterByDateRange(tickets, filters) {
  return tickets.filter(ticket => {
    const created = new Date(ticket.createdAt);

    if (filters.priority && ticket.priority !== filters.priority) {
      return false;
    }

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

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    assignee: '',
    priority: '',
    date: '',
    month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  });
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    apiFetch('/users')
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    setLoadingTickets(true);
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.assignee) query.append('assignee', filters.assignee);
    
    apiFetch(`/tickets?${query.toString()}`)
      .then(setAllTickets)
      .catch(console.error)
      .finally(() => setLoadingTickets(false));
  }, [filters.status, filters.assignee]);

  const displayedTickets = filterByDateRange(allTickets, filters);

  return (
    <div className="container admin-page animate-fade-in">
      <h1 className="page-title mb-lg">Admin Dashboard</h1>

      <div className="admin-tabs hide-desktop">
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          Tickets
        </button>
      </div>

      <div className="admin-layout">
        <div className={`admin-section ${activeTab !== 'users' ? 'hide-mobile' : ''}`}>
          <div className="section-header">
            <h2>User Management</h2>
            <span className="badge">{users.length} Total</span>
          </div>
          
          <div className="card">
            {loadingUsers ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id}>
                        <td className="font-medium">{u.name}</td>
                        <td className="text-secondary">{u.email}</td>
                        <td><span className="badge">{u.role}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className={`admin-section ${activeTab !== 'tickets' ? 'hide-mobile' : ''}`}>
          <div className="section-header">
            <h2>All Tickets</h2>
          </div>
          
          <TicketFilters onFilterChange={setFilters} />
          
          <div className="ticket-list-wrapper">
            {loadingTickets ? (
              <div className="loading-spinner"></div>
            ) : displayedTickets.length > 0 ? (
              displayedTickets.map(ticket => (
                <TicketCard key={ticket._id} ticket={ticket} />
              ))
            ) : (
              <div className="card text-center p-lg">No tickets found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
