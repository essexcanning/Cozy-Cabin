import { GameState, GameObject, Scene } from './types';

export const updateGame = (state: GameState, deltaTime: number) => {
  if (state.ui.chestOpen) return;

  // Handle input
  state.player.dx = 0;
  state.player.dy = 0;
  state.player.isMoving = false;

  if (state.keys['ArrowUp'] || state.keys['w']) {
    state.player.dy = -state.player.speed;
    state.player.facing = 'up';
    state.player.isMoving = true;
  }
  if (state.keys['ArrowDown'] || state.keys['s']) {
    state.player.dy = state.player.speed;
    state.player.facing = 'down';
    state.player.isMoving = true;
  }
  if (state.keys['ArrowLeft'] || state.keys['a']) {
    state.player.dx = -state.player.speed;
    state.player.facing = 'left';
    state.player.isMoving = true;
  }
  if (state.keys['ArrowRight'] || state.keys['d']) {
    state.player.dx = state.player.speed;
    state.player.facing = 'right';
    state.player.isMoving = true;
  }

  // Normalize diagonal movement
  if (state.player.dx !== 0 && state.player.dy !== 0) {
    const length = Math.sqrt(state.player.dx * state.player.dx + state.player.dy * state.player.dy);
    state.player.dx = (state.player.dx / length) * state.player.speed;
    state.player.dy = (state.player.dy / length) * state.player.speed;
  }

  // Animation frame
  if (state.player.isMoving) {
    state.player.animFrame += deltaTime * 0.005; // Slower, smoother animation cycle
  } else {
    // Smoothly return to standing position
    state.player.animFrame = state.player.animFrame * 0.8;
  }

  // Proposed new position (delta-time independent movement)
  // Base speed is 3. We multiply by (deltaTime / 16.666) to normalize to 60fps.
  const timeScale = deltaTime / 16.666;
  let newX = state.player.x + state.player.dx * timeScale;
  let newY = state.player.y + state.player.dy * timeScale;

  // Collision detection
  const currentObjects = state.objects[state.scene];
  let canMoveX = true;
  let canMoveY = true;

  const playerRect = {
    left: newX - state.player.width / 2,
    right: newX + state.player.width / 2,
    top: newY - state.player.height / 2 + 10, // Offset for feet
    bottom: newY + state.player.height / 2,
  };

  // Interior bounds
  if (state.scene === 'inside') {
    const roomWidth = 300;
    const roomHeight = 240;
    if (playerRect.left < -roomWidth / 2 || playerRect.right > roomWidth / 2) canMoveX = false;
    if (playerRect.top < -roomHeight / 2 || playerRect.bottom > roomHeight / 2) canMoveY = false;
  }

  for (const obj of currentObjects) {
    if (!obj.solid) continue;

    const objRect = {
      left: obj.x - obj.width / 2,
      right: obj.x + obj.width / 2,
      top: obj.y - obj.height / 2,
      bottom: obj.y + obj.height / 2,
    };

    // Special case for cabin door
    if (obj.type === 'cabin') {
      // Door is at bottom center
      const doorRect = {
        left: obj.x - 15,
        right: obj.x + 15,
        top: obj.y + obj.height / 2 - 10,
        bottom: obj.y + obj.height / 2 + 10,
      };
      
      if (
        playerRect.right > doorRect.left &&
        playerRect.left < doorRect.right &&
        playerRect.bottom > doorRect.top &&
        playerRect.top < doorRect.bottom
      ) {
        // Enter cabin
        state.scene = 'inside';
        state.player.x = 0;
        state.player.y = 100;
        return; // Skip rest of update this frame
      }
    }

    // Check X collision
    const testRectX = { ...playerRect, top: state.player.y - state.player.height / 2 + 10, bottom: state.player.y + state.player.height / 2 };
    if (
      testRectX.right > objRect.left &&
      testRectX.left < objRect.right &&
      testRectX.bottom > objRect.top &&
      testRectX.top < objRect.bottom
    ) {
      canMoveX = false;
    }

    // Check Y collision
    const testRectY = { ...playerRect, left: state.player.x - state.player.width / 2, right: state.player.x + state.player.width / 2 };
    if (
      testRectY.right > objRect.left &&
      testRectY.left < objRect.right &&
      testRectY.bottom > objRect.top &&
      testRectY.top < objRect.bottom
    ) {
      canMoveY = false;
    }
  }

  if (canMoveX) state.player.x = newX;
  if (canMoveY) state.player.y = newY;

  // Interior exit
  if (state.scene === 'inside' && state.player.y > 105 && Math.abs(state.player.x) < 25) {
    state.scene = 'outside';
    state.player.x = -80;
    state.player.y = 0; // Just outside the door
  }

  // Camera follow
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;

  // Interaction check
  state.interactionText = null;
  state.interactionTarget = null;
  const interactRange = 30;
  
  let interactX = state.player.x;
  let interactY = state.player.y;
  
  if (state.player.facing === 'up') interactY -= interactRange;
  if (state.player.facing === 'down') interactY += interactRange;
  if (state.player.facing === 'left') interactX -= interactRange;
  if (state.player.facing === 'right') interactX += interactRange;

  for (const obj of currentObjects) {
    // Cat movement logic
    if (obj.type === 'cat') {
      if (obj.moveTimer === undefined) obj.moveTimer = 0;
      if (obj.animFrame === undefined) obj.animFrame = 0;
      if (obj.dx === undefined) obj.dx = 0;
      if (obj.dy === undefined) obj.dy = 0;
      if (obj.facing === undefined) obj.facing = 'down';
      if (obj.isMoving === undefined) obj.isMoving = false;

      obj.moveTimer -= deltaTime;
      if (obj.moveTimer <= 0) {
        const action = Math.random();
        if (action < 0.4) {
          obj.dx = 0;
          obj.dy = 0;
          obj.isMoving = false;
          obj.moveTimer = 1000 + Math.random() * 3000;
        } else {
          const speed = 0.8;
          const dir = Math.floor(Math.random() * 4);
          if (dir === 0) { obj.dx = 0; obj.dy = -speed; obj.facing = 'up'; }
          else if (dir === 1) { obj.dx = 0; obj.dy = speed; obj.facing = 'down'; }
          else if (dir === 2) { obj.dx = -speed; obj.dy = 0; obj.facing = 'left'; }
          else if (dir === 3) { obj.dx = speed; obj.dy = 0; obj.facing = 'right'; }
          obj.isMoving = true;
          obj.moveTimer = 500 + Math.random() * 2000;
        }
      }

      if (obj.isMoving) {
        obj.animFrame += deltaTime * 0.005;
        
        let newCatX = obj.x + obj.dx! * timeScale;
        let newCatY = obj.y + obj.dy! * timeScale;
        
        const roomWidth = 280;
        const roomHeight = 220;
        if (newCatX < -roomWidth / 2 || newCatX > roomWidth / 2) {
          obj.dx = -obj.dx!;
          newCatX = obj.x;
          obj.facing = obj.dx! > 0 ? 'right' : 'left';
        }
        if (newCatY < -roomHeight / 2 || newCatY > roomHeight / 2) {
          obj.dy = -obj.dy!;
          newCatY = obj.y;
          obj.facing = obj.dy! > 0 ? 'down' : 'up';
        }

        let canMoveCatX = true;
        let canMoveCatY = true;
        
        const catRect = {
          left: newCatX - obj.width / 2,
          right: newCatX + obj.width / 2,
          top: newCatY - obj.height / 2,
          bottom: newCatY + obj.height / 2,
        };

        for (const otherObj of currentObjects) {
          if (!otherObj.solid || otherObj === obj) continue;
          
          const otherRect = {
            left: otherObj.x - otherObj.width / 2,
            right: otherObj.x + otherObj.width / 2,
            top: otherObj.y - otherObj.height / 2,
            bottom: otherObj.y + otherObj.height / 2,
          };

          const testRectX = { ...catRect, top: obj.y - obj.height / 2, bottom: obj.y + obj.height / 2 };
          if (
            testRectX.right > otherRect.left &&
            testRectX.left < otherRect.right &&
            testRectX.bottom > otherRect.top &&
            testRectX.top < otherRect.bottom
          ) {
            canMoveCatX = false;
          }

          const testRectY = { ...catRect, left: obj.x - obj.width / 2, right: obj.x + obj.width / 2 };
          if (
            testRectY.right > otherRect.left &&
            testRectY.left < otherRect.right &&
            testRectY.bottom > otherRect.top &&
            testRectY.top < otherRect.bottom
          ) {
            canMoveCatY = false;
          }
        }

        if (canMoveCatX) obj.x = newCatX;
        else {
          obj.dx = -obj.dx!;
          obj.facing = obj.dx! > 0 ? 'right' : 'left';
        }
        
        if (canMoveCatY) obj.y = newCatY;
        else {
          obj.dy = -obj.dy!;
          obj.facing = obj.dy! > 0 ? 'down' : 'up';
        }
      } else {
        obj.animFrame = 0;
      }
    }

    if (!obj.interactable) continue;
    
    const objRect = {
      left: obj.x - obj.width / 2 - 10,
      right: obj.x + obj.width / 2 + 10,
      top: obj.y - obj.height / 2 - 10,
      bottom: obj.y + obj.height / 2 + 10,
    };

    if (
      interactX > objRect.left &&
      interactX < objRect.right &&
      interactY > objRect.top &&
      interactY < objRect.bottom
    ) {
      state.interactionTarget = obj;
      if (obj.type === 'bed') {
        state.interactionText = "Press E to sleep";
      } else if (obj.type === 'mailbox') {
        state.interactionText = "Check Relationship Tasks";
      } else if (obj.type === 'tree') {
        state.interactionText = "Press E to gather wood";
      } else if (obj.type === 'chest') {
        state.interactionText = "Press E to open chest";
      } else if (obj.type === 'bookshelf') {
        state.interactionText = "Read a book";
      } else if (obj.type === 'fireplace') {
        state.interactionText = "Warm your hands";
      } else if (obj.type === 'mirror') {
        state.interactionText = "Talk to Relationship Coach";
      } else if (obj.type === 'cabin') {
        // Handled by collision
      }
    }
  }
};
