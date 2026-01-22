
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Car, PitBossMessage } from './types';
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
  
  // React State - Used for UI rendering only
  const [uiState, setUiState] = useState({
    score: 0,
    speed: INITIAL_SPEED,
    lives: 3,
    isGameOver: false,
    gameStarted: false,
  });
  
  const [pitBossMsg, setPitBossMsg] = useState<PitBossMessage | null>(null);
  const requestRef = useRef<number>(0);
  
  // High-frequency game state in Refs (Performance)
  const gameData = useRef({
    score: 0,
    speed: INITIAL_SPEED,
    distance: 0,
    lives: 3,
    isGameOver: false,
    gameStarted: false,
    lastAiScore: 0
  });

  const playerRef = useRef<Car>({
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: CANVAS_HEIGHT - PLAYER_HEIGHT - 40,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: COLORS.player,
    speed: 0,
    type: 'player'
  });
  
  const npcsRef = useRef<Car[]>([]);
  const roadOffsetRef = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const handleAICommentary = useCallback(async (event: string) => {
    const text = await getPitBossCommentary(
      event, 
      gameData.current.score, 
      gameData.current.speed
    );
    setPitBossMsg({
      text,
      timestamp: Date.now(),
      type: 'encouragement'
    });
  }, []);

  const resetGame = () => {
    gameData.current = {
      score: 0,
      speed: INITIAL_SPEED,
      distance: 0,
      lives: 3,
      isGameOver: false,
      gameStarted: true,
      lastAiScore: 0
    };
    
    playerRef.current.x = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
    npcsRef.current = [];
    roadOffsetRef.current = 0;
    
    setUiState({
      score: 0,
      speed: INITIAL_SPEED,
      lives: 3,
      isGameOver: false,
      gameStarted: true,
    });

    handleAICommentary("System Initialized");
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
    if (npcsRef.current.length < 6 && Math.random() < 0.025) {
      const laneWidth = ROAD_WIDTH / 3;
      const lane = Math.floor(Math.random() * 3);
      const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
      
      const newNpc: Car = {
        x: roadStart + lane * laneWidth + (laneWidth - NPC_WIDTH) / 2,
        y: -NPC_HEIGHT - 50,
        width: NPC_WIDTH,
        height: NPC_HEIGHT,
        color: [COLORS.npc1, COLORS.npc2, COLORS.npc3][Math.floor(Math.random() * 3)],
        speed: (Math.random() * 3) + 2,
        type: 'npc'
      };
      
      const isOverlapping = npcsRef.current.some(npc => 
        Math.abs(npc.y - newNpc.y) < NPC_HEIGHT * 2.5 && Math.abs(npc.x - newNpc.x) < 5
      );
      
      if (!isOverlapping) {
        npcsRef.current.push(newNpc);
      }
    }
  };

  const update = () => {
    if (!gameData.current.gameStarted || gameData.current.isGameOver) return;

    // Speed & Score
    gameData.current.speed = Math.min(MAX_SPEED, gameData.current.speed + SPEED_INCREMENT);
    gameData.current.score += 1;
    gameData.current.distance += gameData.current.speed / 1000;

    // AI Check every 1000 points
    if (gameData.current.score - gameData.current.lastAiScore > 1000) {
      gameData.current.lastAiScore = gameData.current.score;
      handleAICommentary("Distance Milestone");
    }

    // Input Handling
    const moveSpeed = 8;
    const roadStart = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
    const roadEnd = roadStart + ROAD_WIDTH;

    if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
      playerRef.current.x = Math.max(roadStart + 5, playerRef.current.x - moveSpeed);
    }
    if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
      playerRef.current.x = Math.min(roadEnd - PLAYER_WIDTH - 5, playerRef.current.x + moveSpeed);
    }

    roadOffsetRef.current = (roadOffsetRef.current + gameData.current.speed) % 80;

    // NPC Logic
    spawnNpc();
    npcsRef.current = npcsRef.current.filter(npc => {
      npc.y += gameData.current.speed - npc.speed;

      // Collision
      const p = playerRef.current;
      if (
        p.x < npc.x + npc.width - 5 &&
        p.x + p.width - 5 > npc.x &&
        p.y < npc.y + npc.height - 5 &&
        p.y + p.height - 5 > npc.y
      ) {
        gameData.current.lives -= 1;
        handleAICommentary("Vehicle Impact");
        
        if (gameData.current.lives <= 0) {
          gameData.current.isGameOver = true;
        }

        // Sync to React for UI feedback
        setUiState(prev => ({ 
          ...prev, 
          lives: gameData.current.lives, 
          isGameOver: gameData.current.isGameOver 
        }));

        return false;
      }
      return npc.y < CANVAS_HEIGHT + 100;
    });

    // Periodic sync for score/speed UI (Every 10 frames)
    if (gameData.current.score % 10 === 0) {
        setUiState(prev => ({
            ...prev,
            score: gameData.current.score,
            speed: gameData.current.speed
        }));
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Environment
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road Base
    const roadX = (CANVAS_WIDTH - ROAD_WIDTH) / 2;
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(roadX, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // Side Rails
    ctx.shadowBlur = 10;
    ctx.shadowColor = COLORS.neon;
    ctx.fillStyle = COLORS.neon;
    ctx.fillRect(roadX - 2, 0, 4, CANVAS_HEIGHT);
    ctx.fillRect(roadX + ROAD_WIDTH - 2, 0, 4, CANVAS_HEIGHT);
    ctx.shadowBlur = 0;

    // Road Markers
    ctx.setLineDash([30, 50]);
    ctx.lineDashOffset = -roadOffsetRef.current;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    [1/3, 2/3].forEach(ratio => {
        ctx.beginPath();
        ctx.moveTo(roadX + ROAD_WIDTH * ratio, 0);
        ctx.lineTo(roadX + ROAD_WIDTH * ratio, CANVAS_HEIGHT);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    // NPCs
    npcsRef.current.forEach(npc => {
      ctx.fillStyle = npc.color;
      ctx.fillRect(npc.x, npc.y, npc.width, npc.height);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(npc.x + 5, npc.y + 10, npc.width - 10, 15); // Windshield
    });

    // Player
    const p = playerRef.current;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.player;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x + 4, p.y + 12, p.width - 8, 20); // Player Cockpit
  };

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          update();
          draw(ctx);
        }
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // Static loop

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-black overflow-hidden select-none">
      {/* HUD */}
      <div className="absolute top-8 left-8 flex flex-col gap-4 z-20">
        <div className="bg-black/40 border border-white/10 p-4 rounded backdrop-blur-md">
          <p className="text-cyan-400 font-orbitron text-[10px] uppercase tracking-widest">Digital Score</p>
          <p className="text-white font-orbitron text-4xl leading-none">{uiState.score.toLocaleString()}</p>
        </div>
        <div className="bg-black/40 border border-white/10 p-4 rounded backdrop-blur-md">
          <p className="text-cyan-400 font-orbitron text-[10px] uppercase tracking-widest">Velocity</p>
          <p className="text-white font-orbitron text-2xl leading-none">{Math.round(uiState.speed * 10)} <span className="text-xs text-zinc-500">KM/H</span></p>
        </div>
      </div>

      <div className="absolute top-8 right-8 z-20 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`w-3 h-10 border ${i < uiState.lives ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_#00f2ff]' : 'bg-zinc-900 border-zinc-800'}`} />
        ))}
      </div>

      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="rounded border border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
      />

      {/* Overlays */}
      {!uiState.gameStarted && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-12 text-center">
          <h1 className="text-7xl font-orbitron font-bold text-white mb-2 tracking-tighter">NEON VELOCITY</h1>
          <div className="h-1 w-32 bg-cyan-500 mb-8" />
          <button 
            onClick={resetGame}
            className="px-16 py-5 bg-white text-black font-orbitron text-xl uppercase font-bold hover:bg-cyan-400 transition-all duration-300"
          >
            START ENGINE
          </button>
          <p className="mt-8 text-zinc-500 font-orbitron text-xs tracking-[0.2em]">USE [A][D] OR ARROWS TO STEER</p>
        </div>
      )}

      {uiState.isGameOver && (
        <div className="absolute inset-0 bg-red-950/90 z-50 flex flex-col items-center justify-center p-12 text-center backdrop-blur-md">
          <h2 className="text-6xl font-orbitron font-bold text-white mb-4">CRITICAL FAILURE</h2>
          <div className="bg-black/50 p-8 rounded mb-8 border border-red-500/30">
            <p className="text-red-400 text-sm font-orbitron uppercase mb-2">Final Data Packet</p>
            <p className="text-white text-5xl font-orbitron font-bold">{uiState.score}</p>
          </div>
          <button 
            onClick={resetGame}
            className="px-16 py-5 border-2 border-white text-white font-orbitron text-xl uppercase font-bold hover:bg-white hover:text-black transition-all"
          >
            REBOOT SYSTEM
          </button>
        </div>
      )}

      <AIPitBoss latestMessage={pitBossMsg} />

      {/* Screen Polish */}
      <div className="absolute inset-0 pointer-events-none z-10 scanlines opacity-10"></div>
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default App;
