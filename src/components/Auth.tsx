import React, { useEffect } from 'react';
import { signInWithPopup, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { LogIn } from 'lucide-react';
import { useLuffa } from '../contexts/LuffaContext';

export const Auth: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);
  const { isLuffa, luffaUser } = useLuffa();

  useEffect(() => {
    if (isLuffa && luffaUser) {
      // Auto sign-in for Luffa users
      signInAnonymously(auth).catch((err) => {
        console.error('Error signing in anonymously:', err);
        setError('Failed to connect to Luffa. Please try again.');
      });
    }
  }, [isLuffa, luffaUser]);

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

  if (isLuffa) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-stone-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-stone-700">
          <h1 className="text-4xl mb-2">🪵</h1>
          <h2 className="text-2xl font-bold text-stone-200 mb-6">Cozy Cabin</h2>
          <div className="text-stone-400 animate-pulse">
            {luffaUser ? `Welcome ${luffaUser.name || 'Player'}! Entering cabin...` : 'Connecting to Luffa...'}
          </div>
          {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="bg-stone-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-stone-700">
        <h1 className="text-3xl font-bold text-stone-100 mb-2">Cozy Cabin</h1>
        <p className="text-stone-400 mb-8">Sign in to create or join a shared world.</p>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white text-stone-900 px-6 py-3 rounded-xl font-medium hover:bg-stone-100 transition-colors"
        >
          <LogIn className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};
