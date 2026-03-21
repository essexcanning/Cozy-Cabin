import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface LuffaUser {
  id: string;
  partnerId: string;
  name?: string;
}

interface LuffaContextType {
  isLuffa: boolean;
  luffaUser: LuffaUser | null;
  edsBalance: number | null;
  sendLuffaNotification: (message: string) => void;
  minimizeApp: () => void;
  sendTransaction: (amount: number, to: string) => Promise<string>;
  refreshBalance: () => void;
}

const LuffaContext = createContext<LuffaContextType>({
  isLuffa: false,
  luffaUser: null,
  edsBalance: null,
  sendLuffaNotification: () => {},
  minimizeApp: () => {},
  sendTransaction: async () => '',
  refreshBalance: () => {},
});

export const useLuffa = () => useContext(LuffaContext);

export const LuffaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLuffa, setIsLuffa] = useState(false);
  const [luffaUser, setLuffaUser] = useState<LuffaUser | null>(null);
  const [edsBalance, setEdsBalance] = useState<number | null>(null);
  const pendingTx = useRef<{ resolve: (hash: string) => void; reject: (err: any) => void } | null>(null);

  useEffect(() => {
    const checkLuffa = () => {
      const w = window as any;
      // Check if running in Luffa webview or iframe
      const isLuffaEnv = !!w.luffa || window.parent !== window;
      
      if (isLuffaEnv) {
        setIsLuffa(true);
        
        // Send handshake to request user info
        window.parent.postMessage({ type: 'LUFFA_GET_APP_INFO' }, '*');
        
        // Fallback for local testing if parent doesn't respond quickly
        if (process.env.NODE_ENV === 'development') {
          setTimeout(() => {
            setLuffaUser(prev => prev || { id: 'luffa_user_1', partnerId: 'luffa_user_2', name: 'Luffa Player' });
          }, 1500);
        }
      }
    };
    
    checkLuffa();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'LUFFA_APP_INFO_RESULT' || data.type === 'LUFFA_APP_INFO') {
        setLuffaUser({
          id: data.user_id || data.userId || 'luffa_user_1',
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
    <LuffaContext.Provider value={{ isLuffa, luffaUser, edsBalance, sendLuffaNotification, minimizeApp, sendTransaction, refreshBalance }}>
      {children}
    </LuffaContext.Provider>
  );
};
