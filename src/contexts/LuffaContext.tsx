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

  const sendToLuffa = React.useCallback((message: any) => {
    const w = window as any;
    console.log('[Luffa Debug] Sending message:', message);
    if (w.wx && w.wx.miniProgram) {
      // TCMPP / WeChat Mini Program
      w.wx.miniProgram.postMessage({ data: message });
      // Also try sendWebviewEvent just in case it's a custom extension
      if (w.wx.miniProgram.sendWebviewEvent) {
        w.wx.miniProgram.sendWebviewEvent(message);
      }
    }
    // Always fallback to iframe postMessage for local testing or if Luffa uses iframe
    window.parent.postMessage(message, '*');
  }, []);

  const forceStart = () => {
    console.log('[Luffa Debug] Force Start triggered.');
    setDebugStatus('Force Start Active');
    setIsLuffa(true); // Set to true so App.tsx hardloads the scene
    setIsLuffaGuest(true);
    setLuffaUser({ id: 'guest_user_123', partnerId: 'guest_partner_123', name: 'Guest Player' });
  };

  useEffect(() => {
    // URL Detection: Master Override
    const urlParams = new URLSearchParams(window.location.search);
    const isLuffaUrl = urlParams.get('platform') === 'luffa';
    
    // Check if user info is passed in URL
    const urlUserId = urlParams.get('userId') || urlParams.get('user_id');
    const urlPartnerId = urlParams.get('partnerId') || urlParams.get('partner_id');
    const urlName = urlParams.get('name') || urlParams.get('userName');

    if (isLuffaUrl || urlUserId) {
      console.log('[Luffa Debug] URL Override detected (platform=luffa or user info present)');
      setIsLuffa(true);
      setLuffaUser({ 
        id: urlUserId || 'luffa_guest_user', 
        partnerId: urlPartnerId || 'luffa_guest_partner', 
        name: urlName || 'Luffa Guest' 
      });
      setDebugStatus('URL Override Active');
    }

    // Check if running in Luffa webview or iframe
    const checkEnv = () => {
      const w = window as any;
      return !!w.luffa || window.parent !== window || (w.wx && w.wx.miniProgram);
    };

    let isLuffaEnv = checkEnv();
    
    if (!isLuffaEnv && !isLuffaUrl && !urlUserId) {
      // Poll for a short time in case the JSSDK is loading asynchronously
      let checks = 0;
      const checkInterval = setInterval(() => {
        checks++;
        if (checkEnv()) {
          clearInterval(checkInterval);
          setIsLuffa(true);
          setDebugStatus('Luffa Env Detected (Async). Handshaking...');
          startHandshake();
        } else if (checks > 10) { // 10 checks * 200ms = 2 seconds
          clearInterval(checkInterval);
        }
      }, 200);
      
      // We need to define startHandshake to be called from the interval
      const startHandshake = () => {
        let attempts = 0;
        const pollHandshake = () => {
          console.log(`[Luffa Debug] Sending LUFFA_GET_APP_INFO (Attempt ${attempts + 1})`);
          setDebugStatus(`Sending LUFFA_GET_APP_INFO (Attempt ${attempts + 1})`);
          sendToLuffa({ type: 'LUFFA_GET_APP_INFO' });
          attempts++;
          if (attempts >= 20) {
            clearInterval(interval);
          }
        };
        
        pollHandshake(); // First immediate attempt
        const interval = setInterval(pollHandshake, 500);
        
        // 3-Second Timeout Fallback
        setTimeout(() => {
          setLuffaUser((prev) => {
            if (!prev) {
              console.log('[Luffa Debug] Handshake timeout. Proceeding as Guest.');
              setDebugStatus('Handshake timeout. Proceeding as Guest.');
              setIsLuffaGuest(true);
              
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
      };
      
      return () => clearInterval(checkInterval);
    }
    
    if (isLuffaEnv && !(isLuffaUrl || urlUserId)) {
      setIsLuffa(true);
      setDebugStatus('Luffa Env Detected. Handshaking...');
      
      // Aggressive Polling Handshake: Send LUFFA_GET_APP_INFO every 500ms for 10 seconds
      let attempts = 0;
      const pollHandshake = () => {
        console.log(`[Luffa Debug] Sending LUFFA_GET_APP_INFO (Attempt ${attempts + 1})`);
        setDebugStatus(`Sending LUFFA_GET_APP_INFO (Attempt ${attempts + 1})`);
        sendToLuffa({ type: 'LUFFA_GET_APP_INFO' });
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
    const handleMessage = (eventOrData: any) => {
      // Handle both MessageEvent (iframe) and direct data object (TCMPP onWebviewEvent)
      const data = eventOrData.data || eventOrData;
      console.log('[Luffa Debug] Received message:', data);
      
      // The "Force True" Hook: If the app receives any message from the parent (even a heartbeat), set Luffa Detected to TRUE.
      if (data) {
        setIsLuffa(true);
        setDebugStatus(`Message received: ${data.type || 'Unknown'}`);
      }

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
    
    // Also listen to TCMPP webview events
    const w = window as any;
    if (w.wx && w.wx.miniProgram && w.wx.miniProgram.onWebviewEvent) {
      w.wx.miniProgram.onWebviewEvent(handleMessage);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (w.wx && w.wx.miniProgram && w.wx.miniProgram.offWebviewEvent) {
        w.wx.miniProgram.offWebviewEvent(handleMessage);
      }
    };
  }, []);

  const refreshBalance = React.useCallback(() => {
    if (isLuffa) {
      sendToLuffa({ type: 'LUFFA_GET_BALANCE' });
    } else {
      // Mock balance for local testing
      setEdsBalance(10.5);
    }
  }, [isLuffa, sendToLuffa]);

  useEffect(() => {
    if (isLuffa) {
      refreshBalance();
    } else {
      setEdsBalance(10.5); // Mock local
    }
  }, [isLuffa, refreshBalance]);

  const sendLuffaNotification = React.useCallback((message: string) => {
    if (isLuffa) {
      sendToLuffa({ type: 'LUFFA_NOTIFICATION', message });
    }
  }, [isLuffa, sendToLuffa]);

  const minimizeApp = React.useCallback(() => {
    if (isLuffa) {
      sendToLuffa({ type: 'LUFFA_MINIMIZE' });
    }
  }, [isLuffa, sendToLuffa]);

  const sendTransaction = React.useCallback((amount: number, to: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!isLuffa) {
        // Mock transaction for local testing
        setTimeout(() => resolve(`0xmock${Math.random().toString(16).slice(2)}`), 2000);
        return;
      }
      
      pendingTx.current = { resolve, reject };
      sendToLuffa({ type: 'LUFFA_SEND_TRANSACTION', amount, to });
    });
  }, [isLuffa, sendToLuffa]);

  return (
    <LuffaContext.Provider value={{ isLuffa, isLuffaGuest, luffaUser, edsBalance, sendLuffaNotification, minimizeApp, sendTransaction, refreshBalance, debugStatus, forceStart }}>
      {children}
    </LuffaContext.Provider>
  );
};
