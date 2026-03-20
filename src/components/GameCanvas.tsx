import React, { useEffect, useRef, useState } from 'react';
import { createInitialState, GameState } from '../game/types';
import { updateGame } from '../game/logic';
import { renderGame } from '../game/render';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';

export default function GameCanvas({ worldId }: { worldId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState] = useState<GameState>(createInitialState());
  const [isChestOpen, setIsChestOpen] = useState(false);
  const [woodCount, setWoodCount] = useState(0);
  const [chestWoodCount, setChestWoodCount] = useState(0);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!worldId) return;
    getDoc(doc(db, 'worlds', worldId)).then(docSnap => {
      if (docSnap.exists()) {
        setInviteCode(docSnap.data().inviteCode);
      }
    });
  }, [worldId]);

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
      if (gameState.ui.chestOpen) {
        if (e.key === 'Escape') {
          setIsChestOpen(false);
          gameState.ui.chestOpen = false;
        }
        return;
      }

      gameState.keys[e.key] = true;
      
      // Handle interactions
      if (e.key === 'e' || e.key === 'E') {
        if (gameState.interactionTarget) {
          const target = gameState.interactionTarget;
          if (target.type === 'tree') {
            gameState.inventory.wood += 1;
            setWoodCount(gameState.inventory.wood);
          } else if (target.type === 'chest') {
            setIsChestOpen(true);
            gameState.ui.chestOpen = true;
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

  const transfer = (item: 'wood', amount: number, toChest: boolean) => {
    const actualAmount = amount === -1 
      ? (toChest ? gameState.inventory[item] : gameState.chest[item])
      : amount;
    
    if (toChest && gameState.inventory[item] >= actualAmount) {
      gameState.inventory[item] -= actualAmount;
      gameState.chest[item] += actualAmount;
    } else if (!toChest && gameState.chest[item] >= actualAmount) {
      gameState.inventory[item] += actualAmount;
      gameState.chest[item] -= actualAmount;
    }
    
    setWoodCount(gameState.inventory.wood);
    setChestWoodCount(gameState.chest.wood);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
      
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

      {/* Chest Menu Overlay */}
      {isChestOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#d7ccc8] p-6 rounded-2xl border-4 border-[#8d6e63] shadow-2xl w-96">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#5d4037]">Storage Chest</h2>
            </div>
            
            <div className="space-y-3">
              {(['wood'] as const).map((item) => {
                const inv = gameState.inventory[item];
                const chest = gameState.chest[item];
                return (
                  <div key={item} className="bg-[#a1887f] p-3 rounded-xl text-white flex items-center justify-between">
                    <div className="font-bold capitalize w-16">{item}</div>
                    <div className="text-sm flex-1 text-center px-2">Inv: {inv} | Chest: {chest}</div>
                    <div className="flex gap-1">
                      <button className="bg-[#5d4037] px-2 py-1 rounded hover:bg-[#4e342e] disabled:opacity-50 font-bold" disabled={inv < 1} onClick={() => transfer(item, 1, true)}>&gt;</button>
                      <button className="bg-[#5d4037] px-2 py-1 rounded hover:bg-[#4e342e] disabled:opacity-50 font-bold" disabled={inv < 1} onClick={() => transfer(item, -1, true)}>&gt;&gt;</button>
                      <button className="bg-[#795548] px-2 py-1 rounded hover:bg-[#6d4c41] disabled:opacity-50 font-bold" disabled={chest < 1} onClick={() => transfer(item, 1, false)}>&lt;</button>
                      <button className="bg-[#795548] px-2 py-1 rounded hover:bg-[#6d4c41] disabled:opacity-50 font-bold" disabled={chest < 1} onClick={() => transfer(item, -1, false)}>&lt;&lt;</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              className="mt-6 w-full bg-gray-400 text-white p-3 rounded-xl hover:bg-gray-500 font-bold transition-colors"
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
