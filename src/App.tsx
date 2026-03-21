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
import { handleFirestoreError, OperationType } from './utils/errorHandling';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [worldId, setWorldId] = useState<string | null>(localStorage.getItem('cozy_cabin_world_id'));
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user already has a world
        const fetchWorld = async (retryCount = 0) => {
          try {
            let userDoc;
            const userDocRef = doc(db, 'users', currentUser.uid);
            try {
              // Try cache first to save quota
              userDoc = await getDocFromCache(userDocRef);
            } catch (e) {
              // Fallback to server if not in cache
              userDoc = await getDoc(userDocRef);
            }
            
            if (userDoc.exists() && userDoc.data().worldId) {
              const id = userDoc.data().worldId;
              setWorldId(id);
              localStorage.setItem('cozy_cabin_world_id', id);
            }
          } catch (error: any) {
            console.error("Error fetching user world:", error);
            if (error.message?.includes('Quota exceeded')) {
              if (retryCount < 2) {
                // Wait 2 seconds and try again
                setTimeout(() => fetchWorld(retryCount + 1), 2000);
                return;
              } else if (!localStorage.getItem('cozy_cabin_world_id')) {
                setQuotaExceeded(true);
              }
            }
            
            if (error.code === 'permission-denied' || error.message?.includes('insufficient permissions')) {
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            }
          }
        };
        
        fetchWorld();
      } else {
        setWorldId(null);
        localStorage.removeItem('cozy_cabin_world_id');
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
