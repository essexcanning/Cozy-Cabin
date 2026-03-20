import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Home, Users, LogOut } from 'lucide-react';

interface WorldSetupProps {
  onWorldJoined: (worldId: string) => void;
}

export const WorldSetup: React.FC<WorldSetupProps> = ({ onWorldJoined }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateWorld = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    
    try {
      const newWorldId = crypto.randomUUID();
      const code = generateInviteCode();
      
      // Create world
      await setDoc(doc(db, 'worlds', newWorldId), {
        inviteCode: code,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        shared: {
          wood: 0,
          cozyCoins: 0,
          tasks: [
            { id: 't1', text: 'Send a sweet message', completed: false },
            { id: 't2', text: 'Plan a weekend walk', completed: false },
            { id: 't3', text: 'Complete a joint check-in', completed: false }
          ],
          purchasedItems: [],
          dateNight: null
        }
      });

      // Update user profile
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName || 'Player',
        email: auth.currentUser.email,
        worldId: newWorldId
      }, { merge: true });

      onWorldJoined(newWorldId);
    } catch (err) {
      console.error(err);
      setError('Failed to create world.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !inviteCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const code = inviteCode.trim().toUpperCase();
      const worldsRef = collection(db, 'worlds');
      const q = query(worldsRef, where('inviteCode', '==', code));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Invalid invite code.');
        setLoading(false);
        return;
      }

      const worldDoc = querySnapshot.docs[0];
      const worldData = worldDoc.data();
      const worldId = worldDoc.id;

      if (worldData.ownerId !== auth.currentUser.uid && worldData.partnerId && worldData.partnerId !== auth.currentUser.uid) {
        setError('This world is already full (max 2 players).');
        setLoading(false);
        return;
      }

      // Add partner if not already set
      if (!worldData.partnerId && worldData.ownerId !== auth.currentUser.uid) {
        await setDoc(doc(db, 'worlds', worldId), {
          partnerId: auth.currentUser.uid
        }, { merge: true });
      }

      // Update user profile
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName || 'Player',
        email: auth.currentUser.email,
        worldId: worldId
      }, { merge: true });

      onWorldJoined(worldId);
    } catch (err) {
      console.error(err);
      setError('Failed to join world.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
      <div className="bg-stone-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-stone-700">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-stone-100">Your World</h1>
          <button 
            onClick={() => auth.signOut()}
            className="text-stone-400 hover:text-stone-200 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-stone-900/50 p-6 rounded-xl border border-stone-700">
            <h2 className="text-lg font-medium text-stone-200 mb-2 flex items-center gap-2">
              <Home className="w-5 h-5" />
              Create New World
            </h2>
            <p className="text-stone-400 text-sm mb-4">
              Start a fresh world and invite your partner to join you.
            </p>
            <button
              onClick={handleCreateWorld}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create World'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-stone-800 text-stone-500">OR</span>
            </div>
          </div>

          <form onSubmit={handleJoinWorld} className="bg-stone-900/50 p-6 rounded-xl border border-stone-700">
            <h2 className="text-lg font-medium text-stone-200 mb-2 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Join Partner's World
            </h2>
            <p className="text-stone-400 text-sm mb-4">
              Enter the 6-character invite code from your partner.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
                maxLength={6}
                className="flex-1 bg-stone-800 border border-stone-600 text-stone-100 px-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500 uppercase font-mono"
              />
              <button
                type="submit"
                disabled={loading || inviteCode.length !== 6}
                className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
