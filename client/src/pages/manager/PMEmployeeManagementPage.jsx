import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../utils/api';

export default function PMEmployeeManagementPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/users?role=employee');
      setEmployees(data.users || data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="container management-page animate-fade-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="management-header">
        <h1 className="page-title">My Employees</h1>
        <Link to="/manager/employees/new" className="btn btn-primary">+ Add Employee</Link>
      </div>

      <div className="card">
        {loading ? <div className="loading-spinner"></div> : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp._id}>
                    <td className="font-medium">{emp.name}</td>
                    <td className="text-secondary">{emp.email}</td>
                    <td><span className={`badge ${emp.status === 'active' ? 'status-active' : 'status-inactive'}`}>{emp.status || 'active'}</span></td>
                  </tr>
                ))}
                {employees.length === 0 && <tr><td colSpan="3" className="text-center text-secondary" style={{ padding: 'var(--space-xl)' }}>No employees yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
