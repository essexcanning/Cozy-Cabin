import { GameState, GameObject } from './types';

export const renderGame = (ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number) => {
  // Clear screen
  ctx.fillStyle = state.scene === 'outside' ? '#8bc34a' : '#1a1a1a'; // Grass green or dark void
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  
  // Center camera on player
  ctx.translate(width / 2 - state.camera.x, height / 2 - state.camera.y);

  if (state.scene === 'outside') {
    drawGrassPattern(ctx, state.camera.x, state.camera.y, width, height);
    drawDirtPath(ctx);
  } else if (state.scene === 'inside') {
    drawInteriorRoom(ctx);
  }

  // Draw floor objects first (like rugs) so they appear under the player
  const floorObjects = state.objects[state.scene].filter(obj => obj.type === 'rug' || obj.type === 'luxury_rug');
  for (const obj of floorObjects) {
    drawObject(ctx, obj);
  }

  // Sort remaining objects by Y position for depth sorting
  const renderables: (GameObject | { type: 'player', isLocal: boolean, uid?: string, y: number })[] = [
    ...state.objects[state.scene].filter(obj => obj.type !== 'rug' && obj.type !== 'luxury_rug'),
    { type: 'player', isLocal: true, y: state.player.y }
  ];

  for (const [uid, otherPlayer] of Object.entries(state.otherPlayers)) {
    if (otherPlayer.scene === state.scene) {
      renderables.push({ type: 'player', isLocal: false, uid, y: otherPlayer.y });
    }
  }

  renderables.sort((a, b) => {
    const yA = a.type === 'player' ? a.y : a.y + (a as GameObject).height / 2;
    const yB = b.type === 'player' ? b.y : b.y + (b as GameObject).height / 2;
    return yA - yB;
  });

  for (const item of renderables) {
    if (item.type === 'player') {
      const pItem = item as any;
      if (pItem.isLocal) {
        drawPlayer(ctx, state.player);
      } else {
        drawPlayer(ctx, state.otherPlayers[pItem.uid]);
      }
    } else {
      drawObject(ctx, item as GameObject);
    }
  }

  if (state.scene === 'inside') {
    const roomWidth = 300;
    const roomHeight = 240;
    const time = Date.now() / 200;
    const flicker = Math.sin(time) * 5;
    const gradient = ctx.createRadialGradient(0, -100, 20 + flicker, 0, -20, roomWidth / 1.2);
    gradient.addColorStop(0, 'rgba(255, 140, 50, 0.2)'); // Warmer, more intense glow
    gradient.addColorStop(0.5, 'rgba(30, 15, 5, 0.3)');
    gradient.addColorStop(1, 'rgba(10, 5, 0, 0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(-roomWidth / 2, -roomHeight / 2, roomWidth, roomHeight);
  }

  ctx.restore();

  // UI Layer
  if (state.interactionText) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(width / 2 - 100, height - 80, 200, 40, 10);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.font = '16px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.interactionText, width / 2, height - 60);
  }

  // HUD Layer
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(20, 20, 120, 40, 8);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 16px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Wood: ${state.inventory.wood}`, 40, 40);
};

const drawGrassPattern = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
  ctx.fillStyle = '#7cb342'; // Slightly darker green for pattern
  const tileSize = 64;
  
  const startX = Math.floor((cx - w / 2) / tileSize) * tileSize;
  const startY = Math.floor((cy - h / 2) / tileSize) * tileSize;
  const endX = startX + w + tileSize;
  const endY = startY + h + tileSize;

  for (let x = startX; x < endX; x += tileSize) {
    for (let y = startY; y < endY; y += tileSize) {
      // Pseudo-random grass tufts
      if ((Math.abs(x * 13 + y * 7) % 100) < 30) {
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 20);
        ctx.lineTo(x + 15, y + 10);
        ctx.lineTo(x + 20, y + 20);
        ctx.fill();
      }
    }
  }
};

const drawDirtPath = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#8d6e63'; // Dirt color
  
  // Path from door downwards
  ctx.beginPath();
  ctx.roundRect(-105, -30, 50, 200, 10);
  ctx.fill();
  
  // Path to mailbox
  ctx.beginPath();
  ctx.roundRect(-60, -10, 100, 30, 10);
  ctx.fill();
  
  // Little dirt patches
  ctx.fillStyle = '#795548';
  ctx.beginPath(); ctx.arc(-90, 20, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-70, 60, 8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-10, 0, 6, 0, Math.PI*2); ctx.fill();
};

const drawInteriorRoom = (ctx: CanvasRenderingContext2D) => {
  const roomWidth = 300;
  const roomHeight = 240;
  
  // Floor base - richer warm wood
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(-roomWidth / 2, -roomHeight / 2, roomWidth, roomHeight);
  
  // Floor planks with staggered cuts and wood grain
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 2;
  for (let x = -roomWidth / 2 + 30; x < roomWidth / 2; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, -roomHeight / 2);
    ctx.lineTo(x, roomHeight / 2);
    ctx.stroke();
    
    // Staggered horizontal cuts
    const offset = (x % 60 === 0) ? 0 : 40;
    for (let y = -roomHeight / 2 + offset; y < roomHeight / 2; y += 80) {
      ctx.beginPath();
      ctx.moveTo(x - 30, y);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Add some nail holes
      ctx.fillStyle = '#4a2e1b';
      ctx.beginPath(); ctx.arc(x - 25, y - 5, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 5, y - 5, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 25, y + 5, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 5, y + 5, 1.5, 0, Math.PI*2); ctx.fill();
    }
  }

  // Walls - rich log cabin style
  ctx.fillStyle = '#5c3a21'; // Darker wall color
  // Top wall
  ctx.fillRect(-roomWidth / 2 - 10, -roomHeight / 2 - 40, roomWidth + 20, 40);
  // Left wall
  ctx.fillRect(-roomWidth / 2 - 10, -roomHeight / 2 - 40, 10, roomHeight + 50);
  // Right wall
  ctx.fillRect(roomWidth / 2, -roomHeight / 2 - 40, 10, roomHeight + 50);
  // Bottom wall (with door gap)
  ctx.fillRect(-roomWidth / 2 - 10, roomHeight / 2, roomWidth / 2 - 20, 10);
  ctx.fillRect(20, roomHeight / 2, roomWidth / 2 - 10, 10);
  
  // Wall log lines (horizontal)
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 1.5;
  for (let y = -roomHeight / 2 - 35; y < -roomHeight / 2; y += 10) {
    ctx.beginPath(); ctx.moveTo(-roomWidth / 2, y); ctx.lineTo(roomWidth / 2, y); ctx.stroke();
  }
  
  // Baseboards
  ctx.fillStyle = '#3e2723';
  ctx.fillRect(-roomWidth / 2, -roomHeight / 2, roomWidth, 10); // Top
  ctx.fillRect(-roomWidth / 2, -roomHeight / 2, 10, roomHeight); // Left
  ctx.fillRect(roomWidth / 2 - 10, -roomHeight / 2, 10, roomHeight); // Right

  // Window on top wall
  ctx.fillStyle = '#81d4fa'; // Sky blue
  ctx.fillRect(-25, -roomHeight / 2 - 30, 50, 30);
  
  // Window frame and panes
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 4;
  ctx.strokeRect(-25, -roomHeight / 2 - 30, 50, 30);
  ctx.beginPath();
  ctx.moveTo(0, -roomHeight / 2 - 30);
  ctx.lineTo(0, -roomHeight / 2);
  ctx.moveTo(-25, -roomHeight / 2 - 15);
  ctx.lineTo(25, -roomHeight / 2 - 15);
  ctx.stroke();

  // Curtains
  ctx.fillStyle = '#c62828'; // Deep red curtains
  // Left curtain
  ctx.beginPath();
  ctx.moveTo(-30, -roomHeight / 2 - 35);
  ctx.lineTo(-15, -roomHeight / 2 - 35);
  ctx.quadraticCurveTo(-25, -roomHeight / 2 - 15, -25, -roomHeight / 2 + 5);
  ctx.lineTo(-30, -roomHeight / 2 + 5);
  ctx.fill();
  // Right curtain
  ctx.beginPath();
  ctx.moveTo(30, -roomHeight / 2 - 35);
  ctx.lineTo(15, -roomHeight / 2 - 35);
  ctx.quadraticCurveTo(25, -roomHeight / 2 - 15, 25, -roomHeight / 2 + 5);
  ctx.lineTo(30, -roomHeight / 2 + 5);
  ctx.fill();
  // Curtain rod
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(-35, -roomHeight / 2 - 35, 70, 4);
  ctx.beginPath(); ctx.arc(-35, -roomHeight / 2 - 33, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(35, -roomHeight / 2 - 33, 4, 0, Math.PI*2); ctx.fill();

  // Painting on the wall
  ctx.fillStyle = '#ffd54f'; // Gold frame
  ctx.fillRect(60, -roomHeight / 2 - 30, 40, 25);
  ctx.fillStyle = '#1565c0'; // Blue sky
  ctx.fillRect(62, -roomHeight / 2 - 28, 36, 21);
  ctx.fillStyle = '#4caf50'; // Green hill
  ctx.beginPath();
  ctx.arc(80, -roomHeight / 2 - 7, 15, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffeb3b'; // Sun
  ctx.beginPath();
  ctx.arc(70, -roomHeight / 2 - 20, 4, 0, Math.PI*2);
  ctx.fill();

  // Plant in the corner
  ctx.fillStyle = '#8d6e63'; // Pot
  ctx.beginPath();
  ctx.moveTo(-roomWidth / 2 + 15, -roomHeight / 2 + 30);
  ctx.lineTo(-roomWidth / 2 + 25, -roomHeight / 2 + 30);
  ctx.lineTo(-roomWidth / 2 + 22, -roomHeight / 2 + 40);
  ctx.lineTo(-roomWidth / 2 + 18, -roomHeight / 2 + 40);
  ctx.fill();
  
  ctx.fillStyle = '#2e7d32'; // Leaves
  ctx.beginPath(); ctx.arc(-roomWidth / 2 + 20, -roomHeight / 2 + 25, 8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-roomWidth / 2 + 14, -roomHeight / 2 + 20, 6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-roomWidth / 2 + 26, -roomHeight / 2 + 20, 6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-roomWidth / 2 + 20, -roomHeight / 2 + 15, 7, 0, Math.PI*2); ctx.fill();

  // Door mat
  ctx.fillStyle = '#3e2723';
  ctx.beginPath();
  ctx.roundRect(-25, roomHeight / 2 - 20, 50, 25, 4);
  ctx.fill();
  
  // Mat pattern
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 2;
  for (let i = -20; i <= 20; i += 5) {
    ctx.beginPath(); ctx.moveTo(i, roomHeight / 2 - 18); ctx.lineTo(i, roomHeight / 2 + 3); ctx.stroke();
  }
  
  ctx.fillStyle = '#d7ccc8';
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WELCOME', 0, roomHeight / 2 - 5);
};

const drawPlayer = (ctx: CanvasRenderingContext2D, player: { x: number, y: number, facing: string, isMoving: boolean, animFrame: number, color?: string, outfit?: string }) => {
  const { x, y, facing, isMoving, animFrame, color, outfit } = player;
  
  ctx.save();
  ctx.translate(x, y);

  // Bobbing animation (absolute sine for a "bounce" step)
  const bob = isMoving ? Math.abs(Math.sin(animFrame * Math.PI * 2)) * 3 : 0;

  // Shadow (scales slightly with bob)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 12 + bob, 10 - bob/4, 4 - bob/8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -bob);

  // Body Tilt
  const tilt = isMoving ? Math.sin(animFrame * Math.PI * 2) * 0.08 : 0;
  ctx.rotate(tilt);

  // Arms (drawn before body if facing up, after if facing down)
  const armSwing = isMoving ? Math.sin(animFrame * Math.PI * 2) * 6 : 0;
  
  const getShirtColor = () => {
    if (outfit === 'outfit_suit') return '#212121';
    if (outfit === 'outfit_pajamas') return '#90caf9';
    if (outfit === 'outfit_winter_coat') return '#d84315';
    if (outfit === 'outfit_dress') return '#f48fb1';
    if (outfit === 'outfit_overalls') return '#e0e0e0'; // Under-shirt for overalls
    return color || '#ffb74d';
  };

  const drawArms = () => {
    ctx.fillStyle = getShirtColor();
    if (facing === 'left' || facing === 'right') {
      // One arm visible
      ctx.beginPath();
      ctx.roundRect(-2 + armSwing, -2, 4, 10, 2);
      ctx.fill();
      
      // Hand
      ctx.fillStyle = '#ffe0b2';
      ctx.beginPath();
      ctx.arc(armSwing, 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Two arms
      ctx.beginPath();
      ctx.roundRect(-12, -2, 4, 10 + armSwing, 2); // Left arm
      ctx.roundRect(8, -2, 4, 10 - armSwing, 2);  // Right arm
      ctx.fill();
      
      // Hands
      ctx.fillStyle = '#ffe0b2';
      ctx.beginPath();
      ctx.arc(-10, 8 + armSwing, 2.5, 0, Math.PI * 2);
      ctx.arc(10, 8 - armSwing, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (facing === 'up') drawArms();

  // Body
  ctx.fillStyle = getShirtColor();
  ctx.beginPath();
  
  if (outfit === 'outfit_dress') {
    // Dress shape
    ctx.moveTo(-6, -5);
    ctx.lineTo(6, -5);
    ctx.lineTo(10, 12);
    ctx.lineTo(-10, 12);
    ctx.fill();
  } else if (outfit === 'outfit_winter_coat') {
    // Bulky coat
    ctx.roundRect(-10, -5, 20, 16, 4);
    ctx.fill();
    // Fluff collar
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 4, 2);
    ctx.fill();
  } else {
    // Regular shirt
    ctx.roundRect(-8, -5, 16, 14, 4);
    ctx.fill();
  }

  // Overalls Details
  if (outfit === 'outfit_overalls') {
    ctx.fillStyle = '#1565c0'; // Denim blue
    ctx.fillRect(-6, 2, 12, 7); // Main bib
    if (facing === 'down' || facing === 'up') {
      ctx.fillRect(-6, -4, 3, 6); // Left strap
      ctx.fillRect(3, -4, 3, 6); // Right strap
    } else {
      ctx.fillRect(-2, -4, 4, 6); // Side strap
    }
  }

  // Suit Details
  if (outfit === 'outfit_suit' && facing === 'down') {
    ctx.fillStyle = '#ffffff'; // White shirt
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.lineTo(3, -5);
    ctx.lineTo(0, 2);
    ctx.fill();
    ctx.fillStyle = '#d32f2f'; // Red tie
    ctx.fillRect(-1, -3, 2, 6);
  }

  if (facing !== 'up') drawArms();

  // Head
  ctx.fillStyle = '#ffe0b2'; // Skin tone
  ctx.beginPath();
  ctx.arc(0, -12, 10, 0, Math.PI * 2);
  ctx.fill();

  // Hair/Hat
  if (outfit === 'outfit_winter_coat') {
    ctx.fillStyle = '#0277bd'; // Beanie
    ctx.beginPath();
    ctx.arc(0, -14, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; // Pom pom
    ctx.beginPath();
    ctx.arc(0, -24, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'outfit_pajamas') {
    ctx.fillStyle = '#90caf9'; // Nightcap
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(10, -14);
    ctx.lineTo(15, -22);
    ctx.lineTo(-5, -25);
    ctx.fill();
    ctx.fillStyle = '#ffffff'; // Pom pom
    ctx.beginPath();
    ctx.arc(15, -22, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#5d4037'; // Brown hair
    ctx.beginPath();
    ctx.arc(0, -14, 10, Math.PI, 0);
    ctx.fill();
  }

  // Face
  ctx.fillStyle = '#3e2723';
  if (facing === 'down') {
    if (outfit === 'outfit_pajamas') {
      // Sleepy eyes
      ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(-2, -10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, -12); ctx.lineTo(2, -10); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-3, -12, 1.5, 0, Math.PI * 2); ctx.fill(); // Left eye
      ctx.beginPath(); ctx.arc(3, -12, 1.5, 0, Math.PI * 2); ctx.fill(); // Right eye
    }
  } else if (facing === 'left') {
    if (outfit === 'outfit_pajamas') {
      ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-3, -10); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-4, -12, 1.5, 0, Math.PI * 2); ctx.fill(); // Left eye
    }
  } else if (facing === 'right') {
    if (outfit === 'outfit_pajamas') {
      ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(3, -10); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(4, -12, 1.5, 0, Math.PI * 2); ctx.fill(); // Right eye
    }
  }

  // Legs
  const getPantsColor = () => {
    if (outfit === 'outfit_suit') return '#212121';
    if (outfit === 'outfit_pajamas') return '#90caf9';
    if (outfit === 'outfit_winter_coat') return '#424242';
    if (outfit === 'outfit_overalls') return '#1565c0';
    if (outfit === 'outfit_dress') return 'transparent'; // Legs hidden by dress
    return '#1565c0'; // Blue pants
  };

  ctx.fillStyle = getPantsColor();
  if (ctx.fillStyle !== 'rgba(0, 0, 0, 0)') { // If not transparent
    const legSwing = isMoving ? Math.sin(animFrame * Math.PI * 2) * 5 : 0;
    
    if (facing === 'left' || facing === 'right') {
      ctx.fillRect(-4 + legSwing, 9, 4, 6);
      ctx.fillRect(-4 - legSwing, 9, 4, 6);
    } else {
      ctx.fillRect(-6, 9, 4, 6 - legSwing);
      ctx.fillRect(2, 9, 4, 6 + legSwing);
    }
  }

  ctx.restore();
};

const drawObject = (ctx: CanvasRenderingContext2D, obj: GameObject) => {
  ctx.save();
  ctx.translate(obj.x, obj.y);

  if (obj.type === 'cabin') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-obj.width/2, obj.height/2 - 10, obj.width, 20);

    // Main body (logs)
    ctx.fillStyle = '#795548';
    ctx.fillRect(-obj.width/2, -obj.height/2 + 20, obj.width, obj.height - 20);
    
    // Log lines
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    for(let i = -obj.height/2 + 30; i < obj.height/2; i += 15) {
      ctx.beginPath();
      ctx.moveTo(-obj.width/2, i);
      ctx.lineTo(obj.width/2, i);
      ctx.stroke();
    }

    // Roof
    ctx.fillStyle = '#d84315'; // Reddish roof
    ctx.beginPath();
    ctx.moveTo(-obj.width/2 - 10, -obj.height/2 + 20);
    ctx.lineTo(0, -obj.height/2 - 30);
    ctx.lineTo(obj.width/2 + 10, -obj.height/2 + 20);
    ctx.fill();
    
    // Roof trim
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Door
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-15, obj.height/2 - 30, 30, 30);
    // Doorknob
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.arc(10, obj.height/2 - 15, 3, 0, Math.PI*2);
    ctx.fill();

    // Window
    ctx.fillStyle = '#81d4fa';
    ctx.fillRect(-obj.width/2 + 20, -obj.height/2 + 40, 25, 25);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-obj.width/2 + 20, -obj.height/2 + 40, 25, 25);
    ctx.beginPath();
    ctx.moveTo(-obj.width/2 + 32.5, -obj.height/2 + 40);
    ctx.lineTo(-obj.width/2 + 32.5, -obj.height/2 + 65);
    ctx.moveTo(-obj.width/2 + 20, -obj.height/2 + 52.5);
    ctx.lineTo(-obj.width/2 + 45, -obj.height/2 + 52.5);
    ctx.stroke();

  } else if (obj.type === 'tree') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, obj.height/2, 15, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-5, 0, 10, obj.height/2);

    // Leaves (layered circles)
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(0, -10, 25, 0, Math.PI*2);
    ctx.fill();
    
    ctx.fillStyle = '#388e3c';
    ctx.beginPath();
    ctx.arc(-10, -20, 20, 0, Math.PI*2);
    ctx.arc(10, -20, 20, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(0, -35, 18, 0, Math.PI*2);
    ctx.fill();

  } else if (obj.type === 'bed') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-obj.width/2 + 5, -obj.height/2 + 5, obj.width, obj.height);
    
    // Headboard
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.roundRect(-obj.width/2, -obj.height/2 - 8, obj.width, 16, 4);
    ctx.fill();
    
    // Bed frame
    ctx.fillStyle = '#795548';
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
    
    // Mattress
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-obj.width/2 + 4, -obj.height/2 + 4, obj.width - 8, obj.height - 8);
    
    // Blanket
    ctx.fillStyle = '#c62828'; // Deep red
    ctx.fillRect(-obj.width/2 + 4, 0, obj.width - 8, obj.height/2 - 4);
    
    // Folded part of blanket
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(-obj.width/2 + 4, 0, obj.width - 8, 10);
    
    // Pillow
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.roundRect(-obj.width/2 + 10, -obj.height/2 + 10, obj.width - 20, 15, 4);
    ctx.fill();

  } else if (obj.type === 'rug') {
    // Fringe
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    for(let i = -obj.width/2 + 4; i < obj.width/2; i += 6) {
      ctx.beginPath(); ctx.moveTo(i, -obj.height/2 - 4); ctx.lineTo(i, -obj.height/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, obj.height/2); ctx.lineTo(i, obj.height/2 + 4); ctx.stroke();
    }
    
    // Rug base
    ctx.fillStyle = '#00695c';
    ctx.beginPath();
    ctx.roundRect(-obj.width/2, -obj.height/2, obj.width, obj.height, 4);
    ctx.fill();
    
    // Inner pattern
    ctx.strokeStyle = '#4db6ac';
    ctx.lineWidth = 2;
    ctx.strokeRect(-obj.width/2 + 6, -obj.height/2 + 6, obj.width - 12, obj.height - 12);
    
    ctx.fillStyle = '#004d40';
    ctx.beginPath();
    ctx.moveTo(0, -obj.height/2 + 15);
    ctx.lineTo(obj.width/2 - 15, 0);
    ctx.lineTo(0, obj.height/2 - 15);
    ctx.lineTo(-obj.width/2 + 15, 0);
    ctx.fill();

  } else if (obj.type === 'table') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-obj.width/2 + 5, obj.height/2, obj.width, 10);

    // Table top
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.roundRect(-obj.width/2, -obj.height/2, obj.width, obj.height, 5);
    ctx.fill();
    
    // Details
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-obj.width/2 + 5, -obj.height/2 + 5, obj.width - 10, obj.height - 10);
    
    // Candle
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI*2); ctx.fill(); // flame

  } else if (obj.type === 'chest') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-obj.width/2 + 5, obj.height/2, obj.width, 10);
    
    // Base
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
    
    // Metal bands
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(-obj.width/2 + 6, -obj.height/2, 4, obj.height);
    ctx.fillRect(obj.width/2 - 10, -obj.height/2, 4, obj.height);
    
    // Lid/Trim
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, 12);
    
    // Lock
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(-6, -obj.height/2 + 6, 12, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(-2, -obj.height/2 + 10, 4, 4);
  } else if (obj.type === 'fireplace') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-obj.width/2 + 5, obj.height/2, obj.width, 10);

    // Chimney/Back
    ctx.fillStyle = '#7f0000'; // Dark brick
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
    
    // Brick lines
    ctx.strokeStyle = '#4a0000';
    ctx.lineWidth = 1;
    for(let i = -obj.height/2 + 10; i < obj.height/2; i += 10) {
      ctx.beginPath(); ctx.moveTo(-obj.width/2, i); ctx.lineTo(obj.width/2, i); ctx.stroke();
      for(let j = -obj.width/2 + ((i/10)%2===0?0:10); j < obj.width/2; j += 20) {
        ctx.beginPath(); ctx.moveTo(j, i); ctx.lineTo(j, i - 10); ctx.stroke();
      }
    }

    // Hearth opening
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.roundRect(-15, 0, 30, obj.height/2, 5);
    ctx.fill();

    // Fire
    const time = Date.now() / 150;
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.moveTo(-10, obj.height/2);
    ctx.lineTo(-5, obj.height/2 - 15 + Math.sin(time)*3);
    ctx.lineTo(0, obj.height/2 - 20 + Math.cos(time)*4);
    ctx.lineTo(5, obj.height/2 - 12 + Math.sin(time*1.5)*3);
    ctx.lineTo(10, obj.height/2);
    ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(-5, obj.height/2);
    ctx.lineTo(0, obj.height/2 - 10 + Math.cos(time)*2);
    ctx.lineTo(5, obj.height/2);
    ctx.fill();

    // Mantle
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-obj.width/2 - 5, -obj.height/2, obj.width + 10, 8);
  } else if (obj.type === 'mirror') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-obj.width/2 + 5, obj.height/2, obj.width, 10);

    // Frame
    ctx.fillStyle = '#ffd54f'; // Gold frame
    ctx.beginPath();
    ctx.roundRect(-obj.width/2, -obj.height/2, obj.width, obj.height, 15);
    ctx.fill();

    // Glass
    ctx.fillStyle = '#e1f5fe'; // Light blue glass
    ctx.beginPath();
    ctx.roundRect(-obj.width/2 + 4, -obj.height/2 + 4, obj.width - 8, obj.height - 8, 12);
    ctx.fill();

    // Reflection lines
    ctx.strokeStyle = '#b3e5fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-obj.width/2 + 10, obj.height/2 - 10);
    ctx.lineTo(obj.width/2 - 10, -obj.height/2 + 10);
    ctx.stroke();
  } else if (obj.type === 'bookshelf') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-obj.width/2 + 5, obj.height/2, obj.width, 10);

    // Frame
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
    
    // Backing
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-obj.width/2 + 4, -obj.height/2 + 4, obj.width - 8, obj.height - 8);

    // Shelves
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-obj.width/2 + 4, -obj.height/2 + 20, obj.width - 8, 4);
    ctx.fillRect(-obj.width/2 + 4, -obj.height/2 + 40, obj.width - 8, 4);

    // Books
    const colors = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a'];
    let bookX = -obj.width/2 + 6;
    // Top shelf
    for(let i=0; i<3; i++) {
      ctx.fillStyle = colors[i%colors.length];
      ctx.fillRect(bookX, -obj.height/2 + 6, 3, 14);
      bookX += 4;
    }
    // Middle shelf
    bookX = -obj.width/2 + 8;
    for(let i=0; i<2; i++) {
      ctx.fillStyle = colors[(i+2)%colors.length];
      ctx.fillRect(bookX, -obj.height/2 + 26, 3, 14);
      bookX += 4;
    }
    // Bottom shelf
    bookX = -obj.width/2 + 6;
    for(let i=0; i<3; i++) {
      ctx.fillStyle = colors[(i+1)%colors.length];
      ctx.fillRect(bookX, -obj.height/2 + 46, 3, 14);
      bookX += 4;
    }
  } else if (obj.type === 'mailbox') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 10, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // Post
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-3, -15, 6, 20);
    
    // Box
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(-10, -30, 20, 15);
    
    // Flag
    ctx.fillStyle = '#e53935';
    ctx.fillRect(10, -30, 4, 10);
    
    // Roof
    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.lineTo(0, -40);
    ctx.lineTo(12, -30);
    ctx.fill();
  } else if (obj.type === 'fence') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-obj.width/2, obj.height/2, obj.width, 5);

    ctx.fillStyle = '#8d6e63'; // Wood color
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
    
    ctx.fillStyle = '#5d4037'; // Darker wood for details
    if (obj.width > obj.height) {
      // Horizontal fence
      ctx.fillRect(-obj.width/2, -obj.height/2 + 2, obj.width, 2); // Top rail
      ctx.fillRect(-obj.width/2, obj.height/2 - 4, obj.width, 2); // Bottom rail
      // Post at the center
      ctx.fillRect(-3, -obj.height/2 - 8, 6, obj.height + 16);
    } else {
      // Vertical fence
      ctx.fillRect(-obj.width/2 + 2, -obj.height/2, 2, obj.height); // Left rail
      ctx.fillRect(obj.width/2 - 4, -obj.height/2, 2, obj.height); // Right rail
      // Post at the center
      ctx.fillRect(-obj.width/2 - 4, -3, obj.width + 8, 6);
    }
  } else if (obj.type === 'cat') {
    const isMoving = obj.isMoving || false;
    const facing = obj.facing || 'down';
    const animFrame = obj.animFrame || 0;
    const catState = obj.catState || 'sleeping';
    
    ctx.fillStyle = '#ff9800'; // Orange tabby
    
    if (catState === 'sleeping') {
      // Sleeping cat
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI*2);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.moveTo(-6, -6); ctx.lineTo(-8, -12); ctx.lineTo(-2, -8);
      ctx.moveTo(6, -6); ctx.lineTo(8, -12); ctx.lineTo(2, -8);
      ctx.fill();
      // Tail
      ctx.strokeStyle = '#f57c00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.quadraticCurveTo(15, 5, 12, 10);
      ctx.stroke();
    } else if (catState === 'playing') {
      // Playing cat (batting at something)
      const bob = Math.sin(animFrame * Math.PI * 2) * 2;
      const pawReach = Math.sin(animFrame * Math.PI * 4) * 6;
      
      // Body
      ctx.beginPath();
      ctx.ellipse(0, 2, 8, 10, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Head
      ctx.beginPath();
      ctx.arc(0, -6 + bob, 6, 0, Math.PI*2);
      ctx.fill();
      
      // Ears
      ctx.beginPath();
      ctx.moveTo(-4, -10 + bob); ctx.lineTo(-6, -16 + bob); ctx.lineTo(-1, -12 + bob);
      ctx.moveTo(4, -10 + bob); ctx.lineTo(6, -16 + bob); ctx.lineTo(1, -12 + bob);
      ctx.fill();
      
      // Paws batting
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.arc(-4, -2 - Math.max(0, pawReach), 3, 0, Math.PI*2); // Left paw
      ctx.arc(4, -2 - Math.max(0, -pawReach), 3, 0, Math.PI*2); // Right paw
      ctx.fill();
      
      // Tail
      ctx.strokeStyle = '#f57c00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const tailWag = Math.sin(animFrame * Math.PI * 6) * 4;
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(tailWag, 18, tailWag * 2, 20);
      ctx.stroke();
      
      // Playful dust/sparks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(0, -15 - Math.abs(pawReach), 2, 0, Math.PI*2);
      ctx.fill();

      // Yarn ball
      ctx.fillStyle = '#e91e63'; // Pink yarn
      ctx.beginPath();
      ctx.arc(0, -18, 4, 0, Math.PI*2);
      ctx.fill();
      // Yarn string
      ctx.strokeStyle = '#e91e63';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(-5, -15, -8, -10);
      ctx.stroke();
    } else {
      // Walking or chasing cat
      const bob = Math.sin(animFrame * Math.PI * 2) * (catState === 'chasing' ? 3 : 2);
      
      // Body
      ctx.beginPath();
      if (facing === 'left' || facing === 'right') {
        const stretch = catState === 'chasing' ? 2 : 0;
        ctx.ellipse(0, bob, 12 + stretch, 7 - stretch/2, 0, 0, Math.PI*2);
      } else {
        const stretch = catState === 'chasing' ? 2 : 0;
        ctx.ellipse(0, bob, 8 - stretch/2, 10 + stretch, 0, 0, Math.PI*2);
      }
      ctx.fill();
      
      // Head
      ctx.beginPath();
      if (facing === 'up') {
        ctx.arc(0, -8 + bob, 6, 0, Math.PI*2);
      } else if (facing === 'down') {
        ctx.arc(0, 8 + bob, 6, 0, Math.PI*2);
      } else if (facing === 'left') {
        ctx.arc(-8, -4 + bob, 6, 0, Math.PI*2);
      } else {
        ctx.arc(8, -4 + bob, 6, 0, Math.PI*2);
      }
      ctx.fill();
      
      // Ears
      ctx.beginPath();
      if (facing === 'up') {
        ctx.moveTo(-4, -12 + bob); ctx.lineTo(-6, -18 + bob); ctx.lineTo(-1, -14 + bob);
        ctx.moveTo(4, -12 + bob); ctx.lineTo(6, -18 + bob); ctx.lineTo(1, -14 + bob);
      } else if (facing === 'down') {
        ctx.moveTo(-4, 4 + bob); ctx.lineTo(-6, -2 + bob); ctx.lineTo(-1, 2 + bob);
        ctx.moveTo(4, 4 + bob); ctx.lineTo(6, -2 + bob); ctx.lineTo(1, 2 + bob);
      } else if (facing === 'left') {
        const earBack = catState === 'chasing' ? 2 : 0;
        ctx.moveTo(-10, -8 + bob); ctx.lineTo(-12 + earBack, -14 + bob); ctx.lineTo(-6, -10 + bob);
        ctx.moveTo(-4, -8 + bob); ctx.lineTo(-2 + earBack, -14 + bob); ctx.lineTo(0, -10 + bob);
      } else {
        const earBack = catState === 'chasing' ? -2 : 0;
        ctx.moveTo(10, -8 + bob); ctx.lineTo(12 + earBack, -14 + bob); ctx.lineTo(6, -10 + bob);
        ctx.moveTo(4, -8 + bob); ctx.lineTo(2 + earBack, -14 + bob); ctx.lineTo(0, -10 + bob);
      }
      ctx.fill();
      
      // Tail
      ctx.strokeStyle = '#f57c00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const tailWag = Math.sin(animFrame * Math.PI * 4) * (catState === 'chasing' ? 5 : 3);
      if (facing === 'up') {
        ctx.moveTo(0, 8 + bob);
        ctx.quadraticCurveTo(tailWag, 15 + bob, tailWag * 2, 18 + bob);
      } else if (facing === 'down') {
        ctx.moveTo(0, -8 + bob);
        ctx.quadraticCurveTo(tailWag, -15 + bob, tailWag * 2, -18 + bob);
      } else if (facing === 'left') {
        ctx.moveTo(10, bob);
        ctx.quadraticCurveTo(15, -5 + bob + tailWag, 18, -10 + bob + tailWag);
      } else {
        ctx.moveTo(-10, bob);
        ctx.quadraticCurveTo(-15, -5 + bob + tailWag, -18, -10 + bob + tailWag);
      }
      ctx.stroke();
      
      // If chasing, add some speed lines and a target (butterfly/sunbeam)
      if (catState === 'chasing') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (facing === 'left') {
          ctx.moveTo(15, bob); ctx.lineTo(25, bob);
          ctx.moveTo(12, bob - 4); ctx.lineTo(20, bob - 4);
        } else if (facing === 'right') {
          ctx.moveTo(-15, bob); ctx.lineTo(-25, bob);
          ctx.moveTo(-12, bob - 4); ctx.lineTo(-20, bob - 4);
        } else if (facing === 'up') {
          ctx.moveTo(0, 15 + bob); ctx.lineTo(0, 25 + bob);
          ctx.moveTo(-4, 12 + bob); ctx.lineTo(-4, 20 + bob);
        } else if (facing === 'down') {
          ctx.moveTo(0, -15 + bob); ctx.lineTo(0, -25 + bob);
          ctx.moveTo(-4, -12 + bob); ctx.lineTo(-4, -20 + bob);
        }
        ctx.stroke();

        // Draw a little yellow sunbeam/butterfly in front of the cat
        const targetDist = 20;
        const flutterX = Math.sin(animFrame * Math.PI * 8) * 3;
        const flutterY = Math.cos(animFrame * Math.PI * 8) * 3;
        
        ctx.fillStyle = 'rgba(255, 235, 59, 0.8)';
        ctx.beginPath();
        if (facing === 'left') {
          ctx.arc(-targetDist + flutterX, bob + flutterY, 2, 0, Math.PI * 2);
        } else if (facing === 'right') {
          ctx.arc(targetDist + flutterX, bob + flutterY, 2, 0, Math.PI * 2);
        } else if (facing === 'up') {
          ctx.arc(flutterX, -targetDist + bob + flutterY, 2, 0, Math.PI * 2);
        } else if (facing === 'down') {
          ctx.arc(flutterX, targetDist + bob + flutterY, 2, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  } else if (obj.type === 'luxury_rug') {
    // Fancy rug
    ctx.fillStyle = '#880e4f'; // Deep purple/red
    ctx.beginPath();
    ctx.roundRect(-obj.width/2, -obj.height/2, obj.width, obj.height, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-obj.width/2 + 5, -obj.height/2 + 5, obj.width - 10, obj.height - 10);
    // Star pattern
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
  } else if (obj.type === 'high_end_lamp') {
    // Base
    ctx.fillStyle = '#37474f';
    ctx.fillRect(-5, obj.height/2 - 5, 10, 5);
    // Stand
    ctx.fillRect(-2, -obj.height/2 + 10, 4, obj.height - 15);
    // Shade
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.moveTo(-10, -obj.height/2 + 15);
    ctx.lineTo(10, -obj.height/2 + 15);
    ctx.lineTo(5, -obj.height/2);
    ctx.lineTo(-5, -obj.height/2);
    ctx.fill();
    // Glow
    const time = Date.now() / 500;
    const glow = 15 + Math.sin(time) * 2;
    ctx.fillStyle = `rgba(255, 235, 59, 0.2)`;
    ctx.beginPath();
    ctx.arc(0, -obj.height/2 + 10, glow, 0, Math.PI*2);
    ctx.fill();
  } else if (obj.type === 'gramophone') {
    // Base
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-10, obj.height/2 - 10, 20, 10);
    // Record
    ctx.fillStyle = '#212121';
    ctx.beginPath(); ctx.ellipse(0, obj.height/2 - 12, 8, 3, 0, 0, Math.PI*2); ctx.fill();
    // Horn
    ctx.fillStyle = '#ffca28'; // Gold
    ctx.beginPath();
    ctx.moveTo(-2, obj.height/2 - 12);
    ctx.quadraticCurveTo(-15, obj.height/2 - 25, -10, -obj.height/2);
    ctx.lineTo(10, -obj.height/2);
    ctx.quadraticCurveTo(5, obj.height/2 - 25, 2, obj.height/2 - 12);
    ctx.fill();
    // Music notes if playing (just random notes for effect)
    const time = Date.now() / 300;
    ctx.fillStyle = '#ffca28';
    ctx.font = '12px Arial';
    ctx.fillText('♪', Math.sin(time)*10, -obj.height/2 - 10 - (time%10));
    ctx.fillText('♫', Math.cos(time)*15, -obj.height/2 - 5 - ((time+5)%10));
  } else if (obj.type === 'potted_plant') {
    // Pot
    ctx.fillStyle = '#d84315';
    ctx.beginPath();
    ctx.moveTo(-8, obj.height/2);
    ctx.lineTo(8, obj.height/2);
    ctx.lineTo(10, obj.height/2 - 15);
    ctx.lineTo(-10, obj.height/2 - 15);
    ctx.fill();
    // Leaves
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(0, obj.height/2 - 25, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-8, obj.height/2 - 20, 10, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, obj.height/2 - 20, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#4caf50';
    ctx.beginPath(); ctx.arc(0, obj.height/2 - 30, 8, 0, Math.PI*2); ctx.fill();
  } else if (obj.type === 'wall_art') {
    // Frame
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
    // Canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-obj.width/2 + 2, -obj.height/2 + 2, obj.width - 4, obj.height - 4);
    // Abstract art
    ctx.fillStyle = '#e91e63';
    ctx.beginPath(); ctx.arc(-5, -5, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2196f3';
    ctx.fillRect(0, 0, 15, 15);
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(0, 20); ctx.lineTo(-20, 20); ctx.fill();
  }

  ctx.restore();
};
