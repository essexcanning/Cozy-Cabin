import React, { useEffect, useRef, useState } from 'react';
import { createInitialState, GameState, Task } from '../game/types';
import { updateGame } from '../game/logic';
import { renderGame } from '../game/render';
import { playSound, toggleBGM } from '../game/audio';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { CharacterCustomization } from './CharacterCustomization';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function GameCanvas({ worldId }: { worldId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState] = useState<GameState>(createInitialState());
  const [isChestOpen, setIsChestOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [coachMessage, setCoachMessage] = useState<string>("Hello! I'm your Cozy Coach. Let me look at your tasks...");
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [particles, setParticles] = useState<{x: number, y: number, id: number}[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  
  const [sharedState, setSharedState] = useState({
    wood: 0,
    cozyCoins: 0,
    tasks: [
      { id: 't1', text: 'Send a sweet message', completed: false },
      { id: 't2', text: 'Plan a weekend walk', completed: false },
      { id: 't3', text: 'Complete a joint check-in', completed: false }
    ],
    purchasedItems: [] as string[],
    dateNight: null as { active: boolean, prompt: string } | null
  });

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const requestRef = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(undefined);
  const lastSyncRef = useRef<number>(0);
  const lastSyncDataRef = useRef<string>('');
  const woodBufferRef = useRef<number>(0);
  const lastWoodSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!worldId) return;
    const worldRef = doc(db, 'worlds', worldId);
    
    // Initial fetch for invite code
    getDoc(worldRef).then(docSnap => {
      if (docSnap.exists()) {
        setInviteCode(docSnap.data().inviteCode);
      }
    }).catch(err => {
      if (err.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      } else if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, `worlds/${worldId}`);
      }
    });

    // Real-time sync for shared state
    const unsubscribe = onSnapshot(worldRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shared) {
          setSharedState(data.shared);
          gameState.shared = data.shared;
          gameState.ui.dateNightOpen = !!data.shared.dateNight?.active;
          
          // Update purchased items in the scene
          const existingCat = gameState.objects.inside.find(obj => obj.type === 'cat');
          
          const newInsideObjects = gameState.objects.inside.filter(obj => 
            !['cat', 'luxury_rug', 'high_end_lamp', 'gramophone', 'potted_plant', 'wall_art'].includes(obj.type)
          );
          
          if (data.shared.purchasedItems?.includes('cat')) {
            if (existingCat) {
              newInsideObjects.push(existingCat);
            } else {
              newInsideObjects.push({ id: 'cat', x: 40, y: -40, width: 20, height: 20, type: 'cat', solid: true, interactable: true });
            }
          }
          if (data.shared.purchasedItems?.includes('luxury_rug')) {
            newInsideObjects.push({ id: 'luxury_rug', x: 0, y: 0, width: 120, height: 80, type: 'luxury_rug', solid: false });
          }
          if (data.shared.purchasedItems?.includes('high_end_lamp')) {
            newInsideObjects.push({ id: 'high_end_lamp', x: -80, y: -20, width: 20, height: 40, type: 'high_end_lamp', solid: true });
          }
          if (data.shared.purchasedItems?.includes('gramophone')) {
            newInsideObjects.push({ id: 'gramophone', x: 80, y: -20, width: 20, height: 30, type: 'gramophone', solid: true });
          }
          if (data.shared.purchasedItems?.includes('potted_plant')) {
            newInsideObjects.push({ id: 'potted_plant', x: -80, y: 80, width: 20, height: 40, type: 'potted_plant', solid: true });
          }
          if (data.shared.purchasedItems?.includes('wall_art')) {
            newInsideObjects.push({ id: 'wall_art', x: 0, y: -100, width: 40, height: 30, type: 'wall_art', solid: false });
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
              purchasedItems: [],
              dateNight: null
            }
          }).catch(err => {
            if (err.message?.includes('Quota exceeded')) {
              setQuotaExceeded(true);
            } else if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
              handleFirestoreError(err, OperationType.WRITE, `worlds/${worldId}`);
            }
          });
        }
      }
    }, (err) => {
      if (err.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      } else if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
        handleFirestoreError(err, OperationType.GET, `worlds/${worldId}`);
      } else {
        console.error("Shared state sync error:", err);
      }
    });

    // Fetch user customization
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(userSnap => {
        if (userSnap.exists()) {
          const userData = userSnap.data();
          gameState.player.gender = userData.gender || 'non-binary';
          gameState.player.hairStyle = userData.hairStyle || 'short';
          gameState.player.hairColor = userData.hairColor || '#5d4037';
          gameState.player.skinColor = userData.skinColor || '#ffe0b2';
          gameState.player.eyeColor = userData.eyeColor || '#3e2723';
          gameState.player.accessory = userData.accessory || 'none';
          gameState.player.facialFeature = userData.facialFeature || 'none';
        }
      }).catch(err => {
        if (err.code === 'permission-denied' || err.message?.includes('insufficient permissions')) {
          handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser!.uid}`);
        }
      });
    }

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
          const existing = gameState.otherPlayers[change.doc.id];
          gameState.otherPlayers[change.doc.id] = {
            x: existing ? existing.x : data.x, // Start from current or initial
            y: existing ? existing.y : data.y,
            targetX: data.x,
            targetY: data.y,
            scene: data.scene,
            facing: data.facing || 'down',
            isMoving: data.isMoving || false,
            animFrame: data.animFrame || 0,
            color: data.color || '#1565c0',
            outfit: data.outfit || 'default',
            gender: data.gender || 'non-binary',
            hairStyle: data.hairStyle || 'short',
            hairColor: data.hairColor || '#5d4037',
            skinColor: data.skinColor || '#ffe0b2',
            eyeColor: data.eyeColor || '#3e2723',
            accessory: data.accessory || 'none',
            facialFeature: data.facialFeature || 'none'
          };
        }
        if (change.type === 'removed') {
          delete gameState.otherPlayers[change.doc.id];
        }
      });
    }, (error) => {
      if (error.message?.includes('Quota exceeded')) {
        setQuotaExceeded(true);
      } else if (error.code === 'permission-denied' || error.message?.includes('insufficient permissions')) {
        handleFirestoreError(error, OperationType.LIST, `worlds/${worldId}/players`);
      }
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
      if (gameState.ui.chestOpen || gameState.ui.tasksOpen || gameState.ui.coachOpen || gameState.ui.dateNightOpen) {
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
          playSound('interact');
          const target = gameState.interactionTarget;
          if (target.type === 'tree') {
            // Local update for responsiveness
            setSharedState(prev => ({ ...prev, wood: prev.wood + 1 }));
            gameState.shared.wood += 1;
            woodBufferRef.current += 1;

            // Throttled sync to Firestore (every 5 seconds or when buffer is large)
            const now = Date.now();
            if (now - lastWoodSyncRef.current > 5000 || woodBufferRef.current >= 5) {
              const amount = woodBufferRef.current;
              woodBufferRef.current = 0;
              lastWoodSyncRef.current = now;
              
              updateDoc(doc(db, 'worlds', worldId), { 
                'shared.wood': increment(amount) 
              }).catch(err => {
                if (err.message?.includes('Quota exceeded')) setQuotaExceeded(true);
              });
            }
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
      
      // Final sync of wood buffer if needed
      if (woodBufferRef.current > 0 && worldId) {
        updateDoc(doc(db, 'worlds', worldId), { 
          'shared.wood': increment(woodBufferRef.current) 
        }).catch(() => {});
      }
    };
  }, [worldId, gameState]);

  const startDateNight = async () => {
    setIsCoachLoading(true);
    try {
      const prompt = `You are a romantic relationship coach. Suggest a cozy, deep conversation prompt or a sweet, simple activity for a couple to do right now while playing a game together. Keep it under 2 sentences.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      await updateDoc(doc(db, 'worlds', worldId), {
        'shared.dateNight': { active: true, prompt: response.text || "Share your favorite memory together." }
      });
      setIsCoachOpen(false);
      gameState.ui.coachOpen = false;
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes('Quota exceeded')) setQuotaExceeded(true);
    } finally {
      setIsCoachLoading(false);
    }
  };

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
        
        // Sync to Firebase (throttle to ~1500ms when moving, ~5000ms when idle)
        const syncInterval = gameState.player.isMoving ? 1500 : 5000;
        if (auth.currentUser && worldId && time - lastSyncRef.current > syncInterval) {
          const syncData = {
            uid: auth.currentUser.uid,
            x: Math.round(gameState.player.x / 10) * 10, // Only sync if moved at least 10 pixels
            y: Math.round(gameState.player.y / 10) * 10,
            scene: gameState.scene,
            facing: gameState.player.facing,
            isMoving: gameState.player.isMoving,
            animFrame: Math.floor(gameState.player.animFrame),
            color: gameState.player.color || '#ffb74d',
            outfit: gameState.player.outfit || 'default',
            gender: gameState.player.gender || 'non-binary',
            hairStyle: gameState.player.hairStyle || 'short',
            hairColor: gameState.player.hairColor || '#5d4037',
            skinColor: gameState.player.skinColor || '#ffe0b2',
            eyeColor: gameState.player.eyeColor || '#3e2723',
            accessory: gameState.player.accessory || 'none',
            facialFeature: gameState.player.facialFeature || 'none'
          };

          const syncDataStr = JSON.stringify(syncData);
          if (syncDataStr !== lastSyncDataRef.current) {
            lastSyncRef.current = time;
            lastSyncDataRef.current = syncDataStr;
            
            setDoc(doc(db, 'worlds', worldId, 'players', auth.currentUser.uid), {
              ...syncData,
              lastUpdated: serverTimestamp()
            }, { merge: true }).catch(err => {
              if (err.message?.includes('Quota exceeded')) {
                setQuotaExceeded(true);
                console.warn("Firestore Quota Exceeded. Sync paused.");
              } else {
                console.error("Sync error:", err);
              }
            });
          }
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

  const [isBgmPlaying, setIsBgmPlaying] = useState(false);

  const handleToggleBgm = () => {
    const newBgmState = !isBgmPlaying;
    setIsBgmPlaying(newBgmState);
    toggleBGM(newBgmState);
  };

  const completeTask = async (taskId: string) => {
    playSound('task');
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
    }).catch(err => {
      if (err.message?.includes('Quota exceeded')) setQuotaExceeded(true);
    });
  };

  const buyItem = async (itemId: string, cost: number) => {
    if (sharedState.cozyCoins >= cost && !sharedState.purchasedItems.includes(itemId)) {
      playSound('buy');
      await updateDoc(doc(db, 'worlds', worldId), {
        'shared.cozyCoins': sharedState.cozyCoins - cost,
        'shared.purchasedItems': [...sharedState.purchasedItems, itemId]
      }).catch(err => {
        if (err.message?.includes('Quota exceeded')) setQuotaExceeded(true);
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

      {/* Quota Exceeded Notification */}
      {quotaExceeded && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-3 animate-bounce">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-bold">Daily Quota Exceeded</p>
            <p className="text-xs opacity-90 text-center">The game will sync again tomorrow. You can still play locally!</p>
          </div>
        </div>
      )}

      {/* Controls Help */}
      <div className="absolute top-4 right-4 bg-black/50 text-white p-4 rounded-xl backdrop-blur-sm flex flex-col gap-4">
        <div className="flex gap-2 justify-between">
          <button 
            onClick={handleToggleBgm}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors flex-1 text-center"
            title="Toggle Music"
          >
            {isBgmPlaying ? '🔊' : '🔇'}
          </button>
          <button 
            onClick={() => {
              setIsCustomizeOpen(true);
              gameState.ui.coachOpen = true; // Reusing this to block input
            }}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors flex-1 text-center"
            title="Customize Character"
          >
            👕
          </button>
        </div>
        
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
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 min-h-[100px] flex items-center justify-center text-center text-blue-900 italic mb-4">
              {isCoachLoading ? "Gazing into the relationship crystal ball..." : coachMessage}
            </div>
            
            <div className="space-y-3">
              <button 
                className="w-full bg-indigo-500 text-white p-3 rounded-xl hover:bg-indigo-600 font-bold transition-colors shadow-md flex items-center justify-center gap-2"
                onClick={startDateNight}
                disabled={isCoachLoading}
              >
                <span>🌙</span> Plan a Date Night
              </button>
              
              <button 
                className="w-full bg-blue-200 text-blue-800 p-3 rounded-xl hover:bg-blue-300 font-bold transition-colors"
                onClick={() => {
                  setIsCoachOpen(false);
                  gameState.ui.coachOpen = false;
                }}
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Night Overlay */}
      {sharedState.dateNight?.active && (
        <div className="absolute inset-0 bg-indigo-950/95 flex flex-col items-center justify-center z-50 backdrop-blur-md">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Simple CSS stars could go here, for now just a gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/50 via-indigo-950/80 to-black"></div>
          </div>
          
          <div className="relative max-w-2xl text-center p-8 z-10">
            <h2 className="text-5xl font-serif italic text-indigo-200 mb-8 tracking-wider">✨ Date Night ✨</h2>
            <div className="bg-indigo-900/50 p-8 rounded-3xl border border-indigo-500/30 shadow-2xl mb-12 backdrop-blur-sm">
              <p className="text-2xl text-indigo-50 leading-relaxed font-medium">
                {sharedState.dateNight.prompt}
              </p>
            </div>
            
            <button 
              onClick={async () => {
                // Add particles
                const newParticles = Array.from({length: 20}).map((_, i) => ({
                  x: window.innerWidth / 2 + (Math.random() * 200 - 100),
                  y: window.innerHeight / 2 + (Math.random() * 200 - 100),
                  id: Date.now() + i
                }));
                setParticles(prev => [...prev, ...newParticles]);
                
                setTimeout(() => {
                  setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
                }, 1000);

                await updateDoc(doc(db, 'worlds', worldId), {
                  'shared.dateNight': null,
                  'shared.cozyCoins': sharedState.cozyCoins + 50
                });
              }}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-10 py-4 rounded-full text-xl font-bold transition-all shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:shadow-[0_0_50px_rgba(99,102,241,0.8)] hover:scale-105"
            >
              We did it! (+50 🪙)
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
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {[
                { id: 'cat', name: 'Pet Cat', cost: 50, icon: '🐈' },
                { id: 'luxury_rug', name: 'Luxury Rug', cost: 30, icon: '🧶' },
                { id: 'high_end_lamp', name: 'Cozy Lamp', cost: 20, icon: '💡' },
                { id: 'gramophone', name: 'Gramophone', cost: 40, icon: '📻' },
                { id: 'potted_plant', name: 'Potted Plant', cost: 15, icon: '🪴' },
                { id: 'wall_art', name: 'Wall Art', cost: 25, icon: '🖼️' },
                { id: 'outfit_overalls', name: 'Overalls', cost: 15, icon: '👖' },
                { id: 'outfit_dress', name: 'Sundress', cost: 15, icon: '👗' },
                { id: 'outfit_suit', name: 'Sharp Suit', cost: 25, icon: '👔' },
                { id: 'outfit_pajamas', name: 'Pajamas', cost: 10, icon: '🥱' },
                { id: 'outfit_winter_coat', name: 'Winter Coat', cost: 20, icon: '🧥' }
              ].map((item) => {
                const isPurchased = sharedState.purchasedItems.includes(item.id);
                const canAfford = sharedState.cozyCoins >= item.cost;
                const isOutfit = item.id.startsWith('outfit_');
                const isEquipped = gameState.player.outfit === item.id;
                
                return (
                  <div key={item.id} className="bg-[#a1887f] p-3 rounded-xl text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.icon}</span>
                      <div className="font-bold">{item.name}</div>
                    </div>
                    {isPurchased ? (
                      isOutfit ? (
                        <button
                          className={`px-3 py-1 rounded-lg font-bold text-sm transition-colors ${isEquipped ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-800 hover:bg-stone-300'}`}
                          onClick={() => {
                            if (!isEquipped) {
                              gameState.player.outfit = item.id;
                              setDoc(doc(db, 'worlds', worldId, 'players', auth.currentUser!.uid), { outfit: item.id }, { merge: true });
                            } else {
                              gameState.player.outfit = 'default';
                              setDoc(doc(db, 'worlds', worldId, 'players', auth.currentUser!.uid), { outfit: 'default' }, { merge: true });
                            }
                          }}
                        >
                          {isEquipped ? 'Equipped' : 'Equip'}
                        </button>
                      ) : (
                        <span className="text-emerald-300 font-bold text-sm">Owned</span>
                      )
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

      {/* Character Customization Overlay */}
      {isCustomizeOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-md p-4">
          <div className="relative max-w-4xl w-full">
            <button 
              className="absolute -top-12 right-0 text-white hover:text-stone-300 font-bold flex items-center gap-2"
              onClick={() => {
                setIsCustomizeOpen(false);
                gameState.ui.coachOpen = false;
              }}
            >
              Cancel
            </button>
            <CharacterCustomization 
              initialData={{
                gender: gameState.player.gender,
                hairStyle: gameState.player.hairStyle,
                hairColor: gameState.player.hairColor,
                skinColor: gameState.player.skinColor,
                eyeColor: gameState.player.eyeColor,
                accessory: gameState.player.accessory,
                facialFeature: gameState.player.facialFeature
              }}
              onComplete={async (customization) => {
                // Update local state
                Object.assign(gameState.player, customization);
                
                // Update Firestore User profile
                if (auth.currentUser) {
                  await setDoc(doc(db, 'users', auth.currentUser.uid), customization, { merge: true });
                }
                
                setIsCustomizeOpen(false);
                gameState.ui.coachOpen = false;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
