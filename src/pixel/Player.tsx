import React, { useEffect, useState } from 'react';
import PixelSprite from './PixelSprite';
import { palette, anims } from './PlayerSpec';

type Props = {
  anim?: keyof typeof anims;
  scale?: number;
  flipX?: boolean;
};

export default function Player({ anim = 'idle', scale = 4, flipX = false }: Props) {
  const seq = anims[anim].frames;
  const fps = anims[anim].fps;
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
    const id = setInterval(() => setI(v => (v + 1) % seq.length), 1000 / Math.max(1, fps));
    return () => clearInterval(id);
  }, [anim, fps, seq.length]);

  return <PixelSprite frame={seq[i]} palette={palette} scale={scale} flipX={flipX} />;
}