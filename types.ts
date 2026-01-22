
export interface GameState {
  score: number;
  distance: number;
  speed: number;
  isGameOver: boolean;
  gameStarted: boolean;
  lives: number;
}

export interface Car {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  speed: number;
  type: 'player' | 'npc';
}

export interface PitBossMessage {
  text: string;
  timestamp: number;
  type: 'encouragement' | 'warning' | 'milestone' | 'trash-talk';
}

export enum GameAction {
  START = 'START',
  RESTART = 'RESTART',
  HIT = 'HIT',
  MILESTONE = 'MILESTONE',
}
