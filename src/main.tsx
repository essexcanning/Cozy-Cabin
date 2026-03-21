import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { LuffaProvider } from './contexts/LuffaContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LuffaProvider>
        <App />
      </LuffaProvider>
    </ErrorBoundary>
  </StrictMode>,
);
