import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silently filter out benign WebSocket errors caused by Vite HMR being disabled in the cloud environment
if (typeof window !== 'undefined') {
  // 1. Intercept console.error and console.warn to suppress benign Vite HMR WebSocket logs
  const originalConsoleError = console.error;
  console.error = function (...args) {
    const msg = args.map(arg => (arg && typeof arg === 'object' && arg.message) ? arg.message : String(arg)).join(' ');
    if (
      msg.includes('[vite] failed to connect to websocket') ||
      msg.includes('WebSocket closed without opened') ||
      msg.toLowerCase().includes('websocket')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args) {
    const msg = args.map(arg => (arg && typeof arg === 'object' && arg.message) ? arg.message : String(arg)).join(' ');
    if (
      msg.includes('[vite] failed to connect to websocket') ||
      msg.includes('WebSocket closed without opened') ||
      msg.toLowerCase().includes('websocket')
    ) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  // 2. Intercept unhandled promise rejections with high priority (capture phase)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason && (reason.message || (typeof reason === 'string' ? reason : ''));
    if (
      msg && (
        msg.includes('WebSocket closed without opened') ||
        msg.includes('[vite] failed to connect to websocket') ||
        msg.toLowerCase().includes('websocket')
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  // 3. Intercept error events with high priority (capture phase)
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('WebSocket closed without opened') ||
      msg.includes('[vite] failed to connect to websocket') ||
      msg.toLowerCase().includes('websocket')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

