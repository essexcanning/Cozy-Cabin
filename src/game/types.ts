export type Scene = 'outside' | 'inside';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface GameObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'tree' | 'cabin' | 'bed' | 'rug' | 'table' | 'chair' | 'mailbox' | 'fence' | 'chest' | 'bookshelf' | 'fireplace' | 'mirror' | 'cat' | 'luxury_rug' | 'high_end_lamp' | 'gramophone' | 'potted_plant' | 'wall_art';
  solid: boolean;
  interactable?: boolean;
  onInteract?: () => void;
  dx?: number;
  dy?: number;
  facing?: 'up' | 'down' | 'left' | 'right';
  isMoving?: boolean;
  animFrame?: number;
  moveTimer?: number;
}

export interface GameState {
  scene: Scene;
  player: {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    dx: number;
    dy: number;
    facing: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    animFrame: number;
    color?: string;
  };
  otherPlayers: {
    [uid: string]: {
      x: number;
      y: number;
      scene: Scene;
      facing: 'up' | 'down' | 'left' | 'right';
      isMoving: boolean;
      animFrame: number;
      color?: string;
    }
  };
  keys: { [key: string]: boolean };
  camera: { x: number; y: number; width: number; height: number };
  objects: {
    outside: GameObject[];
    inside: GameObject[];
  };
  interactionText: string | null;
  interactionTarget: GameObject | null;
  inventory: {
    wood: number;
  };
  chest: {
    wood: number;
  };
  shared: {
    wood: number;
    cozyCoins: number;
    tasks: Task[];
    purchasedItems: string[];
    dateNight: { active: boolean; prompt: string } | null;
  };
  ui: {
    chestOpen: boolean;
    tasksOpen: boolean;
    coachOpen: boolean;
    dateNightOpen: boolean;
  };
}

export const TILE_SIZE = 32;
export const PLAYER_SIZE = 24;

export const createInitialState = (): GameState => {
  const yardLeft = -260;
  const yardRight = 100;
  const yardTop = -220;
  const yardBottom = 140;

  // Generate some trees
  const trees: GameObject[] = [];
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 1600 - 800;
    const y = Math.random() * 1600 - 800;
    // Don't place trees inside the yard
    if (x > yardLeft - 40 && x < yardRight + 40 && y > yardTop - 40 && y < yardBottom + 40) continue;
    
    trees.push({
      id: `tree_${i}`,
      x,
      y,
      width: 40,
      height: 60,
      type: 'tree',
      solid: true,
      interactable: true,
    });
  }

  const fences: GameObject[] = [];
  // Top fence
  for (let x = yardLeft; x <= yardRight; x += 40) {
    fences.push({ id: `fence_t_${x}`, x, y: yardTop, width: 40, height: 10, type: 'fence', solid: true });
  }
  // Bottom fence (with gap for path)
  for (let x = yardLeft; x <= yardRight; x += 40) {
    if (x >= -100 && x <= -60) continue; // Gap for path
    fences.push({ id: `fence_b_${x}`, x, y: yardBottom, width: 40, height: 10, type: 'fence', solid: true });
  }
  // Left fence
  for (let y = yardTop + 20; y <= yardBottom - 20; y += 40) {
    fences.push({ id: `fence_l_${y}`, x: yardLeft, y, width: 10, height: 40, type: 'fence', solid: true });
  }
  // Right fence
  for (let y = yardTop + 20; y <= yardBottom - 20; y += 40) {
    fences.push({ id: `fence_r_${y}`, x: yardRight, y, width: 10, height: 40, type: 'fence', solid: true });
  }

  return {
    scene: 'outside',
    player: {
      x: 0,
      y: 100,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      speed: 3,
      dx: 0,
      dy: 0,
      facing: 'down',
      isMoving: false,
      animFrame: 0,
    },
    otherPlayers: {},
    keys: {},
    camera: { x: 0, y: 0, width: 800, height: 600 },
    interactionText: null,
    interactionTarget: null,
    inventory: { wood: 0 },
    chest: { wood: 0 },
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
    },
    ui: { chestOpen: false, tasksOpen: false, coachOpen: false, dateNightOpen: false },
    objects: {
      outside: [
        {
          id: 'cabin',
          x: -80,
          y: -80,
          width: 160,
          height: 120,
          type: 'cabin',
          solid: true,
          interactable: true,
        },
        {
          id: 'mailbox',
          x: 40,
          y: 0,
          width: 20,
          height: 40,
          type: 'mailbox',
          solid: true,
          interactable: true,
        },
        ...fences,
        ...trees,
      ],
      inside: [
        {
          id: 'fireplace',
          x: 0,
          y: -100,
          width: 60,
          height: 40,
          type: 'fireplace',
          solid: true,
          interactable: true,
        },
        {
          id: 'bookshelf',
          x: -130,
          y: 30,
          width: 20,
          height: 60,
          type: 'bookshelf',
          solid: true,
          interactable: true,
        },
        {
          id: 'bed',
          x: -110,
          y: -70,
          width: 60,
          height: 80,
          type: 'bed',
          solid: true,
          interactable: true,
        },
        {
          id: 'rug',
          x: 0,
          y: 0,
          width: 120,
          height: 80,
          type: 'rug',
          solid: false,
        },
        {
          id: 'table',
          x: 80,
          y: -20,
          width: 60,
          height: 40,
          type: 'table',
          solid: true,
        },
        {
          id: 'chest',
          x: 110,
          y: -90,
          width: 40,
          height: 30,
          type: 'chest',
          solid: true,
          interactable: true,
        },
        {
          id: 'mirror',
          x: -50,
          y: -100,
          width: 30,
          height: 40,
          type: 'mirror',
          solid: true,
          interactable: true,
        }
      ],
    },
  };
};
