import React, { useEffect } from 'react';
import { signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { LogIn } from 'lucide-react';
import { useLuffa } from '../contexts/LuffaContext';

export const Auth: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [showForceStart, setShowForceStart] = React.useState(false);
  const { isLuffa, isLuffaGuest, luffaUser, debugStatus, forceStart } = useLuffa();

  useEffect(() => {
    if (isLuffa || isLuffaGuest) {
      setIsLoggingIn(true);
    }
  }, [isLuffa, isLuffaGuest]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isLoggingIn && !luffaUser) {
      timeout = setTimeout(() => {
        setShowForceStart(true);
      }, 5000);
    } else {
      setShowForceStart(false);
    }
    return () => clearTimeout(timeout);
  }, [isLoggingIn, luffaUser]);

  useEffect(() => {
    if ((isLuffa || isLuffaGuest) && luffaUser) {
      // Auto sign-in for Luffa users or guests
      signInAnonymously(auth).catch((err) => {
        console.error('Error signing in anonymously:', err);
        setError('Failed to connect to Luffa. Please try again.');
        setIsLoggingIn(false);
      });
    }
  }, [isLuffa, isLuffaGuest, luffaUser]);

  const handleSignIn = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Error signing in:', error);
      if (error.message?.includes('Quota exceeded')) {
        setError('Daily database limit reached. Please try again tomorrow.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    }
  };

  const handleManualLuffaLogin = () => {
    setIsLoggingIn(true);
    signInAnonymously(auth).catch((err) => {
      console.error('Error signing in anonymously:', err);
      setError('Failed to connect to Luffa manually. Please try again.');
      setIsLoggingIn(false);
    });
  };

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-stone-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-stone-700">
        <h1 className="text-4xl mb-2">🪵</h1>
        <h2 className="text-2xl font-bold text-stone-200 mb-6">Cozy Cabin</h2>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {isLuffa || isLuffaGuest || isLoggingIn ? (
          <div className="space-y-4">
            <div className="text-stone-400 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="animate-pulse">
                {luffaUser ? `Welcome ${luffaUser.name || 'Player'}! Entering cabin...` : 'Linking Luffa Account...'}
              </p>
            </div>
            
            {showForceStart && (
              <button 
                onClick={forceStart}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-4 rounded-xl transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 mt-4 animate-bounce"
              >
                ENTER CABIN MANUALLY
              </button>
            )}

            {!luffaUser && error && (
              <button 
                onClick={handleManualLuffaLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
              >
                Connect with Luffa
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-stone-400 mb-8">Sign in to create or join a shared world.</p>
            <button 
              onClick={handleSignIn}
              className="w-full bg-white hover:bg-stone-100 text-stone-900 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Google
            </button>
          </>
        )}
      </div>
      
      {/* Deep Debug Label */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="text-xs font-mono text-stone-500 bg-stone-950/50 px-4 py-2 rounded-lg border border-stone-800">
          Luffa Detected: {isLuffa ? 'TRUE' : 'FALSE'} | Guest: {isLuffaGuest ? 'TRUE' : 'FALSE'}
        </div>
        <div className="text-xs font-mono text-stone-500 bg-stone-950/50 px-4 py-2 rounded-lg border border-stone-800 max-w-xs text-center truncate">
          Status: {debugStatus}
        </div>
      </div>
    </div>
  );
};
