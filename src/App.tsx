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
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [worldId, setWorldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user already has a world
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().worldId) {
            setWorldId(userDoc.data().worldId);
          }
        } catch (error) {
          console.error("Error fetching user world:", error);
        }
      } else {
        setWorldId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
