import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';   // Global CSS styles
import App from './App.jsx'; // Main application entry with routing

/*
  REACT ENTRY POINT — v2.0 (PostgreSQL Edition)
  
  All data now flows through the PostgreSQL REST API.
  The old Dexie/IndexedDB sync engine is no longer the primary data store.
*/

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
