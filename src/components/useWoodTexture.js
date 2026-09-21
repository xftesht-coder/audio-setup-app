import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

// Generated locally: no external textures or loading dependency for the finish.
export default function useWoodTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d4c3ae';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 850; i += 1) {
      const y = i * 0.61;
      const wave = Math.sin(i * 1.37);
      ctx.strokeStyle = `rgba(${wave > 0 ? '69,41,21' : '249,236,212'},${0.055 + Math.abs(wave) * 0.16})`;
      ctx.lineWidth = 0.3 + Math.abs(Math.sin(i * 2.41)) * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(270, y + 8 * wave, 640, y - 12 * wave, 1024, y + 3 * wave);
      ctx.stroke();
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.wrapS = map.wrapT = RepeatWrapping;
    map.anisotropy = 8;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
