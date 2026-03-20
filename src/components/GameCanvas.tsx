import React, { useEffect, useRef, useState } from 'react';
import { createInitialState, GameState, Task } from '../game/types';
import { updateGame } from '../game/logic';
import { renderGame } from '../game/render';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function GameCanvas({ worldId }: { worldId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState] = useState<GameState>(createInitialState());
  const [isChestOpen, setIsChestOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [coachMessage, setCoachMessage] = useState<string>("Hello! I'm your Cozy Coach. Let me look at your tasks...");
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [particles, setParticles] = useState<{x: number, y: number, id: number}[]>([]);
  
  const [sharedState, setSharedState] = useState({
    wood: 0,
    cozyCoins: 0,
    tasks: [
      { id: 't1', text: 'Send a sweet message', completed: false },
      { id: 't2', text: 'Plan a weekend walk', completed: false },
      { id: 't3', text: 'Complete a joint check-in', completed: false }
    ],
    purchasedItems: [] as string[]
  });

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!worldId) return;
    const worldRef = doc(db, 'worlds', worldId);
    
    // Initial fetch for invite code
    getDoc(worldRef).then(docSnap => {
      if (docSnap.exists()) {
        setInviteCode(docSnap.data().inviteCode);
      }
    });

    // Real-time sync for shared state
    const unsubscribe = onSnapshot(worldRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shared) {
          setSharedState(data.shared);
          gameState.shared = data.shared;
          
          // Update purchased items in the scene
          const newInsideObjects = gameState.objects.inside.filter(obj => 
            !['cat', 'luxury_rug', 'high_end_lamp'].includes(obj.type)
          );
          
          if (data.shared.purchasedItems?.includes('cat')) {
            newInsideObjects.push({ id: 'cat', x: 40, y: -40, width: 20, height: 20, type: 'cat', solid: true, interactable: true });
          }
          if (data.shared.purchasedItems?.includes('luxury_rug')) {
            newInsideObjects.push({ id: 'luxury_rug', x: 0, y: 0, width: 120, height: 80, type: 'luxury_rug', solid: false });
          }
          if (data.shared.purchasedItems?.includes('high_end_lamp')) {
            newInsideObjects.push({ id: 'high_end_lamp', x: -80, y: -20, width: 20, height: 40, type: 'high_end_lamp', solid: true });
          }
          
          gameState.objects.inside = newInsideObjects;
        } else {
          // Initialize shared state if missing
          updateDoc(worldRef, {
            shared: {
              wood: 0,
              cozyCoins: 0,
              tasks: [
                { id: 't1', text: 'Send a sweet message', completed: false },
                { id: 't2', text: 'Plan a weekend walk', completed: false },
                { id: 't3', text: 'Complete a joint check-in', completed: false }
              ],
              purchasedItems: []
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [worldId, gameState]);

  useEffect(() => {
    if (!auth.currentUser || !worldId) return;

    const playersRef = collection(db, 'worlds', worldId, 'players');
    
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (change.doc.id === auth.currentUser?.uid) return; // Skip our own state

        if (change.type === 'added' || change.type === 'modified') {
          gameState.otherPlayers[change.doc.id] = {
            x: data.x,
            y: data.y,
            scene: data.scene,
            facing: data.facing || 'down',
            isMoving: data.isMoving || false,
            animFrame: data.animFrame || 0,
          };
        }
        if (change.type === 'removed') {
          delete gameState.otherPlayers[change.doc.id];
        }
      });
    }, (error) => {
      console.error('Firestore Error: ', JSON.stringify({
        error: error.message,
        operationType: 'get',
        path: `worlds/${worldId}/players`
      }));
    });

    return () => unsubscribe();
  }, [worldId, gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.ui.chestOpen || gameState.ui.tasksOpen || gameState.ui.coachOpen) {
        if (e.key === 'Escape') {
          setIsChestOpen(false);
          setIsTasksOpen(false);
          setIsCoachOpen(false);
          gameState.ui.chestOpen = false;
          gameState.ui.tasksOpen = false;
          gameState.ui.coachOpen = false;
        }
        return;
      }

      gameState.keys[e.key] = true;
      
      // Handle interactions
      if (e.key === 'e' || e.key === 'E') {
        if (gameState.interactionTarget) {
          const target = gameState.interactionTarget;
          if (target.type === 'tree') {
            const newWood = sharedState.wood + 1;
            setDoc(doc(db, 'worlds', worldId), { shared: { ...sharedState, wood: newWood } }, { merge: true });
          } else if (target.type === 'chest') {
            setIsChestOpen(true);
            gameState.ui.chestOpen = true;
          } else if (target.type === 'mailbox') {
            setIsTasksOpen(true);
            gameState.ui.tasksOpen = true;
          } else if (target.type === 'mirror') {
            setIsCoachOpen(true);
            gameState.ui.coachOpen = true;
            generateCoachAdvice();
          } else if (target.type === 'bed') {
            // Simple sleep effect
            const overlay = document.getElementById('sleep-overlay');
            if (overlay) {
              overlay.style.opacity = '1';
              setTimeout(() => {
                overlay.style.opacity = '0';
              }, 2000);
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const loop = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        const deltaTime = time - lastTimeRef.current;
        
        // Fixed time step for logic
        updateGame(gameState, deltaTime);
        
        // Sync to Firebase (throttle to ~10fps)
        if (auth.currentUser && worldId && time - lastSyncRef.current > 100) {
          lastSyncRef.current = time;
          const syncData = {
            uid: auth.currentUser.uid,
            x: gameState.player.x,
            y: gameState.player.y,
            scene: gameState.scene,
            facing: gameState.player.facing,
            isMoving: gameState.player.isMoving,
            animFrame: gameState.player.animFrame,
            lastUpdated: serverTimestamp()
          };
          // console.log("Syncing data:", syncData);
          setDoc(doc(db, 'worlds', worldId, 'players', auth.currentUser.uid), syncData, { merge: true }).catch(err => console.error("Sync error:", err));
        }

        // Render
        renderGame(ctx, gameState, canvas.width, canvas.height);
      }
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState]);

  const generateCoachAdvice = async () => {
    setIsCoachLoading(true);
    try {
      const completedTasks = sharedState.tasks.filter(t => t.completed).map(t => t.text);
      const prompt = `You are a warm, encouraging relationship coach. The couple has completed these tasks recently: ${completedTasks.length > 0 ? completedTasks.join(', ') : 'None yet'}. Give them a short, sweet personalized suggestion for a Date Night or connection activity (max 2 sentences).`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setCoachMessage(response.text || "Keep up the great work!");
    } catch (error) {
      console.error("Coach error:", error);
      setCoachMessage("I'm having trouble connecting to my thoughts right now, but I'm proud of you two!");
    } finally {
      setIsCoachLoading(false);
    }
  };

  const completeTask = async (taskId: string) => {
    const newTasks = sharedState.tasks.map(t => 
      t.id === taskId ? { ...t, completed: true } : t
    );
    
    // Add particles
    const newParticles = Array.from({length: 10}).map((_, i) => ({
      x: window.innerWidth / 2 + (Math.random() * 100 - 50),
      y: window.innerHeight / 2 + (Math.random() * 100 - 50),
      id: Date.now() + i
    }));
    setParticles(prev => [...prev, ...newParticles]);
    
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);

    await updateDoc(doc(db, 'worlds', worldId), {
      'shared.tasks': newTasks,
      'shared.cozyCoins': sharedState.cozyCoins + 10
    });
  };

  const buyItem = async (itemId: string, cost: number) => {
    if (sharedState.cozyCoins >= cost && !sharedState.purchasedItems.includes(itemId)) {
      await updateDoc(doc(db, 'worlds', worldId), {
        'shared.cozyCoins': sharedState.cozyCoins - cost,
        'shared.purchasedItems': [...sharedState.purchasedItems, itemId]
      });
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 bg-black/50 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-amber-700 text-xl">🪵</span> Wood: {sharedState.wood}
        </div>
        <div className="flex items-center gap-2 font-bold">
          <span className="text-yellow-400 text-xl">🪙</span> Cozy Coins: {sharedState.cozyCoins}
        </div>
      </div>

      {/* Heart Particles */}
      {particles.map(p => (
        <div 
          key={p.id}
          className="absolute text-pink-500 text-3xl animate-float-up pointer-events-none"
          style={{ left: p.x, top: p.y }}
        >
          ❤️
        </div>
      ))}

      {/* Sleep Transition Overlay */}
      <div 
        id="sleep-overlay"
        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-1000 flex items-center justify-center"
        style={{ opacity: 0 }}
      >
        <span className="text-white text-2xl font-serif italic">Zzz...</span>
      </div>

      {/* Controls Help */}
      <div className="absolute top-4 right-4 bg-black/50 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col gap-4">
        <div>
          <h2 className="font-bold mb-2">Controls</h2>
          <ul className="text-sm space-y-1 text-gray-200">
            <li>WASD / Arrows to move</li>
            <li>E to interact / gather</li>
            <li>Walk into door to enter</li>
          </ul>
        </div>
        
        {inviteCode && (
          <div className="pt-4 border-t border-white/20">
            <h2 className="font-bold mb-1 text-emerald-400">Invite Partner</h2>
            <div className="bg-black/40 px-3 py-2 rounded text-center font-mono text-lg tracking-widest select-all mb-4">
              {inviteCode}
            </div>
          </div>
        )}

        <button 
          onClick={() => auth.signOut()}
          className="w-full bg-red-900/50 hover:bg-red-800/50 text-red-200 py-2 rounded text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Tasks Menu Overlay */}
      {isTasksOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-pink-50 p-6 rounded-2xl border-4 border-pink-200 shadow-2xl w-96">
            <h2 className="text-2xl font-bold text-pink-800 mb-6 flex items-center gap-2">
              <span>💌</span> Relationship Tasks
            </h2>
            <div className="space-y-3">
              {sharedState.tasks.map(task => (
                <div key={task.id} className="bg-white p-4 rounded-xl shadow-sm border border-pink-100 flex items-center justify-between">
                  <span className={`text-pink-900 ${task.completed ? 'line-through opacity-50' : ''}`}>
                    {task.text}
                  </span>
                  {!task.completed && (
                    <button 
                      onClick={() => completeTask(task.id)}
                      className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                    >
                      Done (+10 🪙)
                    </button>
                  )}
                  {task.completed && <span className="text-pink-400">❤️</span>}
                </div>
              ))}
            </div>
            <button 
              className="mt-6 w-full bg-pink-200 text-pink-800 p-3 rounded-xl hover:bg-pink-300 font-bold transition-colors"
              onClick={() => {
                setIsTasksOpen(false);
                gameState.ui.tasksOpen = false;
              }}
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Coach Menu Overlay */}
      {isCoachOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-blue-50 p-6 rounded-2xl border-4 border-blue-200 shadow-2xl w-96">
            <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-2">
              <span>✨</span> Magic Mirror Coach
            </h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 min-h-[100px] flex items-center justify-center text-center text-blue-900 italic">
              {isCoachLoading ? "Gazing into the relationship crystal ball..." : coachMessage}
            </div>
            <button 
              className="mt-6 w-full bg-blue-200 text-blue-800 p-3 rounded-xl hover:bg-blue-300 font-bold transition-colors"
              onClick={() => {
                setIsCoachOpen(false);
                gameState.ui.coachOpen = false;
              }}
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Chest / Shop Menu Overlay */}
      {isChestOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#d7ccc8] p-6 rounded-2xl border-4 border-[#8d6e63] shadow-2xl w-96">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#5d4037]">Cozy Shop</h2>
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold text-sm border border-yellow-300">
                {sharedState.cozyCoins} 🪙
              </div>
            </div>
            
            <div className="space-y-3">
              {[
                { id: 'cat', name: 'Pet Cat', cost: 50, icon: '🐈' },
                { id: 'luxury_rug', name: 'Luxury Rug', cost: 30, icon: '🧶' },
                { id: 'high_end_lamp', name: 'Cozy Lamp', cost: 20, icon: '💡' }
              ].map((item) => {
                const isPurchased = sharedState.purchasedItems.includes(item.id);
                const canAfford = sharedState.cozyCoins >= item.cost;
                return (
                  <div key={item.id} className="bg-[#a1887f] p-3 rounded-xl text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="font-bold">{item.name}</div>
                    </div>
                    {isPurchased ? (
                      <span className="text-emerald-300 font-bold text-sm">Owned</span>
                    ) : (
                      <button 
                        className={`px-3 py-1 rounded-lg font-bold text-sm transition-colors ${canAfford ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
                        disabled={!canAfford}
                        onClick={() => buyItem(item.id, item.cost)}
                      >
                        {item.cost} 🪙
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              className="mt-6 w-full bg-[#8d6e63] text-white p-3 rounded-xl hover:bg-[#795548] font-bold transition-colors"
              onClick={() => {
                setIsChestOpen(false);
                gameState.ui.chestOpen = false;
              }}
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
