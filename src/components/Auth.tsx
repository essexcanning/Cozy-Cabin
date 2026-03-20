import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { LogIn } from 'lucide-react';

export const Auth: React.FC = () => {
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
      alert('Failed to sign in. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="bg-stone-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-stone-700">
        <h1 className="text-3xl font-bold text-stone-100 mb-2">Cozy Cabin</h1>
        <p className="text-stone-400 mb-8">Sign in to create or join a shared world.</p>
        
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
