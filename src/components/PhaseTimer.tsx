import React, { useState, useEffect, useRef } from 'react';

interface PhaseTimerProps {
  duration: number; // in seconds
  startTime: number;
  label: string;
  onComplete?: () => void;
  color?: 'amber' | 'red' | 'green';
}

export const PhaseTimer: React.FC<PhaseTimerProps> = ({ duration, startTime, label, onComplete, color = 'amber' }) => {
  const [remaining, setRemaining] = useState(duration);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset when component mounts or key changes
  useEffect(() => {
    setRemaining(duration);
    hasCompletedRef.current = false;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);
      if (rem <= 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [duration, startTime]);

  const percentage = (remaining / duration) * 100;
  const seconds = Math.ceil(remaining);
  
  const colorClasses = {
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    green: 'from-green-500 to-green-600',
  };

  const textColor = {
    amber: 'text-amber-400',
    red: 'text-red-400',
    green: 'text-green-400',
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
        <span className={`text-lg font-mono font-bold ${seconds <= 5 ? 'text-red-400 animate-pulse' : textColor[color]}`}>
          {seconds}s
        </span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorClasses[color]} transition-all duration-100 ease-linear rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
