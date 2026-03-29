import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';         // Global CSS styles and Tailwind base
import App from './App.jsx';   // Main application entry with routing

/* 
  REACT ENTRY POINT
  This file initializes the React virtual DOM and mounts it 
  to the 'root' div in index.html.
*/

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
