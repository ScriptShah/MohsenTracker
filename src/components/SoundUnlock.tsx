'use client';

import { useEffect } from 'react';
import { unlockAudio } from '@/lib/sounds';

/** iOS Safari + most desktop browsers start the AudioContext suspended
 *  until a user gesture. Resume on the first interaction so the very
 *  first sound (typically a habit tick) is audible instead of silent. */
export function SoundUnlock() {
  useEffect(() => {
    const onGesture = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
    window.addEventListener('pointerdown', onGesture, { once: false });
    window.addEventListener('keydown', onGesture, { once: false });
    window.addEventListener('touchstart', onGesture, { once: false });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
  }, []);
  return null;
}
