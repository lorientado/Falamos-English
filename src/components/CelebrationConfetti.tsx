import React, { useEffect, useRef, useState } from 'react';
import confetti, { CreateTypes } from 'canvas-confetti';
import { CelebrationEvent, getConfettiBursts } from '../utils/celebration';

interface CelebrationConfettiProps {
  event: CelebrationEvent | null;
  reduceMotion?: boolean;
}

export const CelebrationConfetti: React.FC<CelebrationConfettiProps> = ({
  event,
  reduceMotion = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<CreateTypes | null>(null);
  const [burstCount, setBurstCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const instance = confetti.create(canvas, {
      resize: true,
      useWorker: false,
    });
    instanceRef.current = instance;

    return () => {
      try {
        instance.reset();
      } catch {
        // ignore cleanup error
      }
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!event || reduceMotion) return;
    const instance = instanceRef.current;
    if (!instance) return;

    const bursts = getConfettiBursts(event.kind);
    const timers: number[] = [];

    setBurstCount((c) => c + 1);

    for (const burst of bursts) {
      if (burst.delayMs <= 0) {
        void instance(burst.options);
      } else {
        const id = window.setTimeout(() => {
          void instance(burst.options);
        }, burst.delayMs);
        timers.push(id);
      }
    }

    return () => {
      for (const id of timers) {
        window.clearTimeout(id);
      }
    };
  }, [event, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="celebration-confetti"
      data-last-kind={event?.kind ?? ''}
      data-burst-count={burstCount}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 w-full h-full"
    />
  );
};
