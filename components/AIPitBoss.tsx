
import React, { useEffect, useState } from 'react';
import { PitBossMessage } from '../types';

interface AIPitBossProps {
  latestMessage: PitBossMessage | null;
}

const AIPitBoss: React.FC<AIPitBossProps> = ({ latestMessage }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (latestMessage) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [latestMessage]);

  return (
    <div className={`fixed bottom-8 right-8 flex flex-col items-end transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
      <div className="bg-black/80 border-2 border-cyan-400 p-4 rounded-xl max-w-xs shadow-[0_0_20px_rgba(0,242,255,0.3)] backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
          </div>
          <span className="text-cyan-400 font-orbitron text-xs tracking-widest uppercase">Pit Boss Beta-7</span>
        </div>
        <p className="text-white text-sm font-medium italic leading-relaxed">
           "{latestMessage?.text}"
        </p>
      </div>
    </div>
  );
};

export default AIPitBoss;
