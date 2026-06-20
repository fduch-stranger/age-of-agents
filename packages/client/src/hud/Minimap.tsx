import { useEffect, useRef } from 'react';
import { getGameView } from '../game/view';
import { TEAM_COLORS } from '../game/placeholders';
import { getTheme } from '../theme';
import { useSettings } from '../settings';

const W = 180;
const H = 120;

/** Minimap: buildings + units; click moves the camera. */
export function Minimap() {
  const themeId = useSettings((s) => s.themeId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const theme = getTheme(themeId);
    const sx = W / theme.grid.w;
    const sy = H / theme.grid.h;

    const bg = `#${(theme.terrain.base & 0xfefefe).toString(16).padStart(6, '0')}`;
    const timer = setInterval(() => {
      ctx.fillStyle = bg;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;

      for (const b of theme.buildings) {
        ctx.fillStyle = `#${b.placeholderColor.toString(16).padStart(6, '0')}`;
        ctx.fillRect(b.gx * sx, b.gy * sy, Math.max(3, b.w * sx), Math.max(3, b.h * sy));
      }

      const view = getGameView();
      if (view) {
        for (const dot of view.unitDots()) {
          const color = TEAM_COLORS[dot.colorIndex % TEAM_COLORS.length];
          ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
          const r = dot.isPeon ? 2 : 3.5;
          ctx.beginPath();
          ctx.arc(dot.gx * sx, dot.gy * sy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1a1a17';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }, 200);
    return () => clearInterval(timer);
  }, [themeId]);

  return (
    <div className="hud-panel minimap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={(e) => {
          const grid = getTheme(useSettings.getState().themeId).grid;
          const rect = e.currentTarget.getBoundingClientRect();
          const gx = ((e.clientX - rect.left) / W) * grid.w;
          const gy = ((e.clientY - rect.top) / H) * grid.h;
          getGameView()?.centerOn(gx, gy);
        }}
      />
    </div>
  );
}
