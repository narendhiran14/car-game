
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Car, PitBossMessage, GameAction } from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  ROAD_WIDTH, 
  PLAYER_WIDTH, 
  PLAYER_HEIGHT, 
  NPC_WIDTH, 
  NPC_HEIGHT, 
  INITIAL_SPEED, 
  COLORS,
  MAX_SPEED,
  SPEED_INCREMENT
} from './constants';
import AIPitBoss from './components/AIPitBoss';
import { getPitBossCommentary } from './services/geminiService';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    distance: 0,
    speed: INITIAL_SPEED,
    isGameOver: false,
    gameStarted: false,
    lives: 3,
  });
  
  const [pitBossMsg, setPitBossMsg] = useState<PitBossMessage | null>(null);
  const requestRef = useRef<number>();
  
  // Game Objects Mutable State
  const playerRef = useRef<Car>({
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: CANVAS_HEIGHT - PLAYER_HEIGHT - 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: COLORS.player,
    speed: 0,
    type: 'player'
  });
  
  const npcsRef = useRef<Car[]>([]);
  const roadOffsetRef = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const lastScoreMilestone = useRef(0);

  const handleAICommentary = useCallback(async (event: string) => {
    const text = await getPitBossCommentary(event, gameState.score, gameState.speed);
    setPitBossMsg({
      text,
      timestamp: Date.now(),
      type: 'encouragement'
    });
  }, [gameState.score, gameState.speed]);

  const resetGame = () => {
    setGameState({
      score: 0,
      distance: 0,
      speed: INITIAL_SPEED,
      isGameOver: false,
      gameStarted: true,
      lives: 3
    });
    playerRef.current.x = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
    npcsRef.current = [];
    roadOffsetRef.current = 0;
    lastScoreMilestone.current = 0;
    handleAICommentary("Game Start");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current[e.code] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnNpc = () => {
    if (npcsRef.current.length < 5 && Math.random() < 0.02) {
      const laneWidth = ROAD_WIDTH / 3;
      const lane = Math.floor(Math.random() * 3);
      const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
      
      const newNpc: Car = {
        x: roadStart + lane * laneWidth + (laneWidth - NPC_WIDTH) / 2,
        y: -NPC_HEIGHT,
        width: NPC_WIDTH,
        height: NPC_HEIGHT,
        color: [COLORS.npc1, COLORS.npc2, COLORS.npc3][Math.floor(Math.random() * 3)],
        speed: (Math.random() * 2) + 2,
        type: 'npc'
      };
      
      // Prevent overlapping on spawn
      const isOverlapping = npcsRef.current.some(npc => 
        Math.abs(npc.y - newNpc.y) < NPC_HEIGHT * 2 && npc.x === newNpc.x
      );
      
      if (!isOverlapping) {
        npcsRef.current.push(newNpc);
      }
    }
  };

  const update = () => {
    if (!gameState.gameStarted || gameState.isGameOver) return;

    // Update Speed
    setGameState(prev => ({
      ...prev,
      speed: Math.min(MAX_SPEED, prev.speed + SPEED_INCREMENT),
      distance: prev.distance + prev.speed / 100,
      score: prev.score + 1
    }));

    // Check milestones
    if (gameState.score - lastScoreMilestone.current > 1000) {
      lastScoreMilestone.current = gameState.score;
      handleAICommentary("Distance Milestone reached");
    }

    // Move Player
    const moveSpeed = 7;
    const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
    const roadEnd = roadStart + ROAD_WIDTH;

    if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
      playerRef.current.x = Math.max(roadStart, playerRef.current.x - moveSpeed);
    }
    if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
      playerRef.current.x = Math.min(roadEnd - PLAYER_WIDTH, playerRef.current.x + moveSpeed);
    }

    // Move Road
    roadOffsetRef.current = (roadOffsetRef.current + gameState.speed) % 100;

    // Move NPCs & Collision
    spawnNpc();
    npcsRef.current = npcsRef.current.filter(npc => {
      npc.y += gameState.speed - npc.speed;

      // Simple collision (AABB)
      const p = playerRef.current;
      if (
        p.x < npc.x + npc.width &&
        p.x + p.width > npc.x &&
        p.y < npc.y + npc.height &&
        p.y + p.height > npc.y
      ) {
        // Hit!
        handleAICommentary("Crash");
        setGameState(prev => {
          if (prev.lives <= 1) {
            return { ...prev, isGameOver: true, lives: 0 };
          }
          return { ...prev, lives: prev.lives - 1, score: Math.max(0, prev.score - 500) };
        });
        return false; // Remove this car
      }

      return npc.y < CANVAS_HEIGHT + 100;
    });
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grass/Sides
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Road
    const roadX = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(roadX, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // Road Borders (Neon)
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.neon;
    ctx.strokeStyle = COLORS.neon;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(roadX, 0);
    ctx.lineTo(roadX, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(roadX + ROAD_WIDTH, 0);
    ctx.lineTo(roadX + ROAD_WIDTH, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Road Lines
    ctx.setLineDash([40, 40]);
    ctx.lineDashOffset = -roadOffsetRef.current;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 4;
    
    // Left Lane
    ctx.beginPath();
    ctx.moveTo(roadX + ROAD_WIDTH / 3, 0);
    ctx.lineTo(roadX + ROAD_WIDTH / 3, CANVAS_HEIGHT);
    ctx.stroke();

    // Right Lane
    ctx.beginPath();
    ctx.moveTo(roadX + (ROAD_WIDTH / 3) * 2, 0);
    ctx.lineTo(roadX + (ROAD_WIDTH / 3) * 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw NPCs
    npcsRef.current.forEach(npc => {
      // Car Body
      ctx.fillStyle = npc.color;
      ctx.fillRect(npc.x, npc.y, npc.width, npc.height);
      // Windshield
      ctx.fillStyle = '#000';
      ctx.fillRect(npc.x + 5, npc.y + 10, npc.width - 10, 15);
      // Headlights
      ctx.fillStyle = '#fff';
      ctx.fillRect(npc.x + 5, npc.y + npc.height - 10, 8, 5);
      ctx.fillRect(npc.x + npc.width - 13, npc.y + npc.height - 10, 8, 5);
    });

    // Draw Player
    const p = playerRef.current;
    ctx.shadowBlur = 20;
    ctx.shadowColor = COLORS.player;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.shadowBlur = 0;
    // Player details
    ctx.fillStyle = '#111';
    ctx.fillRect(p.x + 5, p.y + 15, p.width - 10, 20); // windshield
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(p.x + 5, p.y + p.height - 5, 10, 4); // brake lights
    ctx.fillRect(p.x + p.width - 15, p.y + p.height - 5, 10, 4);
  };

  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        update();
        draw(ctx);
      }
    }
    requestRef.current = requestAnimationFrame(renderLoop);
  }, [gameState]); // Re-bind when state updates for logic clarity

  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [renderLoop]);

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-zinc-950 overflow-hidden select-none">
      {/* HUD Left */}
      <div className="absolute top-8 left-8 flex flex-col gap-4 z-20">
        <div className="bg-black/60 border border-cyan-500/30 p-4 rounded-lg backdrop-blur-md">
          <p className="text-cyan-400 font-orbitron text-[10px] uppercase tracking-tighter">Score</p>
          <p className="text-white font-orbitron text-3xl">{gameState.score}</p>
        </div>
        <div className="bg-black/60 border border-cyan-500/30 p-4 rounded-lg backdrop-blur-md">
          <p className="text-cyan-400 font-orbitron text-[10px] uppercase tracking-tighter">Speed</p>
          <p className="text-white font-orbitron text-2xl">{Math.round(gameState.speed * 10)} <span className="text-sm">MPH</span></p>
        </div>
      </div>

      {/* HUD Right */}
      <div className="absolute top-8 right-8 flex flex-col gap-2 z-20">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div 
              key={i} 
              className={`w-8 h-8 flex items-center justify-center rounded-full border ${i < gameState.lives ? 'border-red-500 bg-red-500/20' : 'border-zinc-700 bg-zinc-800'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${i < gameState.lives ? 'text-red-500' : 'text-zinc-600'}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
          ))}
        </div>
      </div>

      {/* Main Game Canvas */}
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/5"
      />

      {/* Overlays */}
      {!gameState.gameStarted && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-8 text-center backdrop-blur-xl">
          <h1 className="text-6xl md:text-8xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-4 animate-pulse">
            NEON VELOCITY
          </h1>
          <p className="text-cyan-200/60 max-w-md mb-12 font-medium">
            AI-Augmented Hyper-Driver Simulation. 
            Avoid the grid-locked automatons. Listen to your Pit Boss.
          </p>
          <button 
            onClick={resetGame}
            className="group relative px-12 py-4 bg-transparent border-2 border-cyan-400 text-cyan-400 font-orbitron text-xl uppercase tracking-widest hover:bg-cyan-400 hover:text-black transition-all duration-300 rounded-sm overflow-hidden"
          >
            <span className="relative z-10">Initialize Grid</span>
            <div className="absolute inset-0 bg-cyan-400 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
          </button>
          <div className="mt-12 grid grid-cols-2 gap-8 text-cyan-500/40 text-xs font-orbitron">
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-2">
                <span className="p-2 border border-cyan-500/20 rounded">A</span>
                <span className="p-2 border border-cyan-500/20 rounded">D</span>
              </div>
              <span>STEER</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-2">
                 <span className="p-2 border border-cyan-500/20 rounded">←</span>
                 <span className="p-2 border border-cyan-500/20 rounded">→</span>
              </div>
              <span>CONTROL</span>
            </div>
          </div>
        </div>
      )}

      {gameState.isGameOver && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-8 text-center animate-in fade-in duration-700">
          <h2 className="text-red-500 font-orbitron text-5xl mb-2">SYSTEM FAILURE</h2>
          <p className="text-zinc-500 font-orbitron mb-8 tracking-widest">VEHICLE COMPROMISED</p>
          
          <div className="grid grid-cols-2 gap-4 mb-12 w-full max-w-sm">
            <div className="bg-zinc-900/50 p-6 rounded-lg border border-red-500/20">
               <p className="text-zinc-500 text-[10px] uppercase font-orbitron">Final Score</p>
               <p className="text-white text-3xl font-orbitron">{gameState.score}</p>
            </div>
            <div className="bg-zinc-900/50 p-6 rounded-lg border border-red-500/20">
               <p className="text-zinc-500 text-[10px] uppercase font-orbitron">Distance</p>
               <p className="text-white text-3xl font-orbitron">{gameState.distance.toFixed(1)}k</p>
            </div>
          </div>

          <button 
            onClick={resetGame}
            className="px-12 py-4 bg-red-600 text-white font-orbitron text-xl uppercase tracking-widest hover:bg-red-500 transition-colors rounded-sm shadow-[0_0_30px_rgba(220,38,38,0.4)]"
          >
            Re-Link Matrix
          </button>
        </div>
      )}

      {/* AI PIT BOSS DISPLAY */}
      <AIPitBoss latestMessage={pitBossMsg} />

      {/* Screen Effects */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-20 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_100%)]"></div>
      <div className="absolute inset-0 pointer-events-none z-10 scanlines opacity-5"></div>
    </div>
  );
};

export default App;
