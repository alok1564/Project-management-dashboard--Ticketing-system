import React from 'react';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="container footer-inner">
        <span className="footer-brand">
          MULTIPLIER<span className="footer-logo-badge">AI</span>
        </span>
        <span className="footer-tagline">Project  Management Dashboard</span>
        <span className="footer-copy">© {year} Multiplier AI</span>
      </div>
    </footer>
  );
}