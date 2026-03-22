import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Home, Users, LogOut } from 'lucide-react';
import { CharacterCustomization } from './CharacterCustomization';
import { useLuffa } from '../contexts/LuffaContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface WorldSetupProps {
  onWorldJoined: (worldId: string) => void;
}

type SetupStep = 'choose' | 'customize';

export const WorldSetup: React.FC<WorldSetupProps> = ({ onWorldJoined }) => {
  const [step, setStep] = useState<SetupStep>('choose');
  const [pendingWorldId, setPendingWorldId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { isLuffa, luffaUser } = useLuffa();

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateWorld = async () => {
    // We allow creation if there's a real user OR a mock user from Luffa fallback
    const userId = auth.currentUser?.uid || (luffaUser ? luffaUser.id : null);
    if (!userId) {
      setError('You must be signed in to create a world. Please check your connection or environment settings.');
      return;
    }
    setLoading(true);
    setError('');
    
    const newWorldId = crypto.randomUUID();
    try {
      const code = generateInviteCode();
      
      // Create world
      try {
        await setDoc(doc(db, 'worlds', newWorldId), {
          inviteCode: code,
          ownerId: userId,
          createdAt: serverTimestamp(),
          shared: {
            wood: 0,
            cozyCoins: 0,
            heartsSent: 0,
            tasks: [
              { id: 't1', text: 'Send a sweet message', completed: false },
              { id: 't2', text: 'Plan a weekend walk', completed: false },
              { id: 't3', text: 'Complete a joint check-in', completed: false }
            ],
            purchasedItems: [],
            dateNight: null
          }
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `worlds/${newWorldId}`);
      }

      setPendingWorldId(newWorldId);
      setStep('customize');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Quota exceeded')) {
        setError('Daily database limit reached. Please try again tomorrow.');
      } else if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, `worlds/${newWorldId}`);
      } else {
        setError('Failed to create world.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = auth.currentUser?.uid || (luffaUser ? luffaUser.id : null);
    if (!userId) {
      setError('You must be signed in to join a world. Please check your connection or environment settings.');
      return;
    }
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const code = inviteCode.trim().toUpperCase();
      const worldsRef = collection(db, 'worlds');
      const q = query(worldsRef, where('inviteCode', '==', code));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (err: any) {
        if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
          handleFirestoreError(err, OperationType.LIST, 'worlds');
        }
        throw err;
      }

      if (querySnapshot.empty) {
        setError('Invalid invite code.');
        setLoading(false);
        return;
      }

      const worldDoc = querySnapshot.docs[0];
      const worldData = worldDoc.data();
      const worldId = worldDoc.id;

      if (worldData.ownerId !== userId && worldData.partnerId && worldData.partnerId !== userId) {
        setError('This world is already full (max 2 players).');
        setLoading(false);
        return;
      }

      // Add partner if not already set
      if (!worldData.partnerId && worldData.ownerId !== userId) {
        try {
          await setDoc(doc(db, 'worlds', worldId), {
            partnerId: userId
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `worlds/${worldId}`);
        }
      }

      setPendingWorldId(worldId);
      setStep('customize');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Quota exceeded')) {
        setError('Daily database limit reached. Please try again tomorrow.');
      } else {
        setError('Failed to join world.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomizationComplete = async (customization: any) => {
    const userId = auth.currentUser?.uid || (luffaUser ? luffaUser.id : null);
    if (!userId || !pendingWorldId) return;
    setLoading(true);
    
    try {
      // Update user profile with worldId AND customization
      try {
        await setDoc(doc(db, 'users', userId), {
          uid: userId,
          displayName: customization.displayName || auth.currentUser?.displayName || luffaUser?.name || 'Player',
          email: auth.currentUser?.email || null,
          worldId: pendingWorldId,
          ...customization
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }

      onWorldJoined(pendingWorldId);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }
      setError('Failed to save character customization.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'customize') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <CharacterCustomization 
          onComplete={handleCustomizationComplete} 
          onBack={() => setStep('choose')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full">
        <div className="flex flex-col md:flex-row gap-8 items-stretch">
          {/* Left Side: Branding/Intro */}
          <div className="flex-1 flex flex-col justify-center space-y-6 p-4">
            <div className="text-6xl mb-2">🪵</div>
            <h1 className="text-5xl font-bold text-white tracking-tight leading-none">
              Welcome to <br />
              <span className="text-emerald-500">Cozy Cabin</span>
            </h1>
            <p className="text-stone-400 text-lg max-w-sm">
              A shared space for you and your partner to build, grow, and remember together.
            </p>
            
            <div className="pt-8">
              <button 
                onClick={() => auth.signOut()}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-300 transition-colors text-sm font-medium uppercase tracking-widest"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Right Side: Options */}
          <div className="flex-1 space-y-6">
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-200 p-4 rounded-xl text-sm animate-shake">
                {error}
              </div>
            )}

            {/* Create Option */}
            <div className="group bg-stone-900 border border-stone-800 p-8 rounded-3xl hover:border-emerald-500/50 transition-all duration-300 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                  <Home className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Start a New Journey</h2>
              <p className="text-stone-400 text-sm mb-6">
                Create a fresh world and get an invite code to share with your partner.
              </p>
              <button
                onClick={handleCreateWorld}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold transition-all transform group-hover:scale-[1.02] disabled:opacity-50 shadow-lg shadow-emerald-900/20"
              >
                {loading ? 'Creating...' : 'Launch New World'}
              </button>
            </div>

            {/* Join Option */}
            <div className="group bg-stone-900 border border-stone-800 p-8 rounded-3xl hover:border-indigo-500/50 transition-all duration-300 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Join Your Partner</h2>
              <p className="text-stone-400 text-sm mb-6">
                Already have an invite code? Enter it below to enter your shared cabin.
              </p>
              
              <form onSubmit={handleJoinWorld} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ENTER INVITE CODE"
                    maxLength={6}
                    className="w-full bg-stone-950 border border-stone-800 text-white px-6 py-4 rounded-2xl focus:outline-none focus:border-indigo-500 uppercase font-mono text-center text-xl tracking-[0.2em] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || inviteCode.length !== 6}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold transition-all transform group-hover:scale-[1.02] disabled:opacity-50 shadow-lg shadow-indigo-900/20"
                >
                  {loading ? 'Joining...' : 'Enter World'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

