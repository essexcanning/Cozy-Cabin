/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { Auth } from './components/Auth';
import { WorldSetup } from './components/WorldSetup';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getDocFromCache } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [worldId, setWorldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user already has a world
        try {
          let userDoc;
          try {
            // Try cache first to save quota
            userDoc = await getDocFromCache(doc(db, 'users', currentUser.uid));
          } catch (e) {
            // Fallback to server if not in cache
            userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          }
          
          if (userDoc.exists() && userDoc.data().worldId) {
            setWorldId(userDoc.data().worldId);
          }
        } catch (error: any) {
          console.error("Error fetching user world:", error);
          if (error.message?.includes('Quota exceeded')) {
            setQuotaExceeded(true);
          }
        }
      } else {
        setWorldId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (quotaExceeded) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-800 p-8 rounded-2xl shadow-xl border border-red-500/30 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Daily Quota Exceeded</h1>
          <p className="text-stone-400 mb-6">
            The application has reached its daily limit for database operations. 
            This usually resets every 24 hours. Please try again later!
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-stone-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!worldId) {
    return <WorldSetup onWorldJoined={(id) => setWorldId(id)} />;
  }

  return (
    <main className="w-full h-screen overflow-hidden relative">
      <GameCanvas worldId={worldId} />
    </main>
  );
}
