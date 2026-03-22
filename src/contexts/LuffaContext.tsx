import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface LuffaUser {
  id: string;
  partnerId: string;
  name?: string;
}

interface LuffaContextType {
  isLuffa: boolean;
  isLuffaGuest: boolean;
  luffaUser: LuffaUser | null;
  edsBalance: number | null;
  sendLuffaNotification: (message: string) => void;
  minimizeApp: () => void;
  sendTransaction: (amount: number, to: string) => Promise<string>;
  refreshBalance: () => void;
  debugStatus: string;
  forceStart: () => void;
}

const LuffaContext = createContext<LuffaContextType>({
  isLuffa: false,
  isLuffaGuest: false,
  luffaUser: null,
  edsBalance: null,
  sendLuffaNotification: () => {},
  minimizeApp: () => {},
  sendTransaction: async () => '',
  refreshBalance: () => {},
  debugStatus: '',
  forceStart: () => {},
});

export const useLuffa = () => useContext(LuffaContext);

export const LuffaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLuffa, setIsLuffa] = useState(false);
  const [isLuffaGuest, setIsLuffaGuest] = useState(false);
  const [luffaUser, setLuffaUser] = useState<LuffaUser | null>(null);
  const [edsBalance, setEdsBalance] = useState<number | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>('Initializing...');
  const pendingTx = useRef<{ resolve: (hash: string) => void; reject: (err: any) => void } | null>(null);

  const forceStart = () => {
    console.log('[Luffa Debug] Force Start triggered.');
    setDebugStatus('Force Start Active');
    setIsLuffa(false);
    setIsLuffaGuest(true);
    setLuffaUser({ id: 'guest_user_123', partnerId: 'guest_partner_123', name: 'Guest Player' });
  };

  useEffect(() => {
    // URL Detection: Master Override
    const urlParams = new URLSearchParams(window.location.search);
    const isLuffaUrl = urlParams.get('platform') === 'luffa';

    if (isLuffaUrl) {
      console.log('[Luffa Debug] URL Override detected (platform=luffa)');
      setIsLuffa(true);
      setLuffaUser({ id: 'luffa_guest_user', partnerId: 'luffa_guest_partner', name: 'Luffa Guest' });
      setDebugStatus('URL Override Active');
    }

    // Check if running in Luffa webview or iframe
    const w = window as any;
    const isLuffaEnv = !!w.luffa || window.parent !== window;
    
    if (isLuffaEnv && !isLuffaUrl) {
      setIsLuffa(true);
      setDebugStatus('Luffa Env Detected. Handshaking...');
      
      // Aggressive Polling Handshake: Send LUFFA_GET_APP_INFO every 500ms for 10 seconds
      let attempts = 0;
      const pollHandshake = () => {
        console.log(`[Luffa Debug] Sending LUFFA_GET_APP_INFO (Attempt ${attempts + 1})`);
        setDebugStatus(`Sending LUFFA_GET_APP_INFO (Attempt ${attempts + 1})`);
        window.parent.postMessage({ type: 'LUFFA_GET_APP_INFO' }, '*');
        attempts++;
        if (attempts >= 20) {
          clearInterval(interval);
        }
      };
      
      pollHandshake(); // First immediate attempt
      const interval = setInterval(pollHandshake, 500);
      
      // 3-Second Timeout Fallback
      const timeoutId = setTimeout(() => {
        setLuffaUser((prev) => {
          if (!prev) {
            console.log('[Luffa Debug] Handshake timeout. Proceeding as Guest.');
            setDebugStatus('Handshake timeout. Proceeding as Guest.');
            setIsLuffaGuest(true);
            
            // Try to get a persistent anonymous ID
            let guestId = localStorage.getItem('luffa_guest_id');
            if (!guestId) {
              guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
              localStorage.setItem('luffa_guest_id', guestId);
            }
            
            return { id: guestId, partnerId: 'luffa_guest_partner', name: 'Luffa Guest' };
          }
          return prev;
        });
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeoutId);
      };
    }

    // Fallback for local testing if parent doesn't respond quickly
    if (process.env.NODE_ENV === 'development' && !isLuffaUrl && !isLuffaEnv) {
      setDebugStatus('Local Dev Mode');
      setTimeout(() => {
        setIsLuffa(true);
        setLuffaUser(prev => prev || { id: 'luffa_user_1', partnerId: 'luffa_user_2', name: 'Luffa Player' });
      }, 1500);
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[Luffa Debug] Received message:', event.data);
      
      // The "Force True" Hook: If the app receives any message from the parent (even a heartbeat), set Luffa Detected to TRUE.
      if (event.data) {
        setIsLuffa(true);
        setDebugStatus(`Message received: ${event.data.type || 'Unknown'}`);
      }

      const data = event.data;
      if (!data) return;

      if (data.type === 'LUFFA_APP_INFO_RESULT' || data.type === 'LUFFA_APP_INFO' || data.user_id || data.luffa_user_id) {
        setDebugStatus('Handshake successful!');
        setIsLuffaGuest(false);
        setLuffaUser({
          id: data.user_id || data.luffa_user_id || data.userId || 'luffa_user_1',
          name: data.name || data.userName || 'Luffa Player',
          partnerId: data.partner_id || data.partnerId || 'luffa_user_2'
        });
      } else if (data.type === 'LUFFA_BALANCE_RESULT') {
        setEdsBalance(data.balance);
      } else if (data.type === 'LUFFA_TRANSACTION_RESULT') {
        if (pendingTx.current) {
          if (data.error) {
            pendingTx.current.reject(new Error(data.error));
          } else {
            pendingTx.current.resolve(data.hash);
          }
          pendingTx.current = null;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const refreshBalance = () => {
    if (isLuffa) {
      window.parent.postMessage({ type: 'LUFFA_GET_BALANCE' }, '*');
    } else {
      // Mock balance for local testing
      setEdsBalance(10.5);
    }
  };

  useEffect(() => {
    if (isLuffa) {
      refreshBalance();
    } else {
      setEdsBalance(10.5); // Mock local
    }
  }, [isLuffa]);

  const sendLuffaNotification = (message: string) => {
    if (isLuffa) {
      window.parent.postMessage({ type: 'LUFFA_NOTIFICATION', message }, '*');
    }
  };

  const minimizeApp = () => {
    if (isLuffa) {
      window.parent.postMessage({ type: 'LUFFA_MINIMIZE' }, '*');
    }
  };

  const sendTransaction = (amount: number, to: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isLuffa) {
        // Mock transaction for local testing
        setTimeout(() => resolve(`0xmock${Math.random().toString(16).slice(2)}`), 2000);
        return;
      }
      
      pendingTx.current = { resolve, reject };
      window.parent.postMessage({ type: 'LUFFA_SEND_TRANSACTION', amount, to }, '*');
    });
  };

  return (
    <LuffaContext.Provider value={{ isLuffa, isLuffaGuest, luffaUser, edsBalance, sendLuffaNotification, minimizeApp, sendTransaction, refreshBalance, debugStatus, forceStart }}>
      {children}
    </LuffaContext.Provider>
  );
};
