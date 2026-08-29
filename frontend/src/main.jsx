import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import PasscodeGate from './components/PasscodeGate.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PasscodeGate>
        <App />
      </PasscodeGate>
    </BrowserRouter>
  </React.StrictMode>,
);
