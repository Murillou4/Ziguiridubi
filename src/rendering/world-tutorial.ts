import type { TutorialCue } from '../domain/Tutorial.ts';
import type { Camera } from './Camera.ts';
import { drawTutorialIcon, TUTORIAL_ICONS } from './tutorial-icons.ts';

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function drawWorldTutorial(
  ctx: CanvasRenderingContext2D, cue: TutorialCue, camera: Camera, player: { x: number; y: number },
  width: number, height: number, time: number
): void {
  const { zoom } = camera;
  const screenX = (worldX: number) => width / 2 + (worldX - camera.x) * zoom;
  const screenY = (worldY: number) => height / 2 + (worldY - camera.y) * zoom;
  const x = screenX(cue.x);
  const y = screenY(cue.y);
  const iconY = y - cue.lift * zoom;
  const top = Math.min(height * .24, 86);
  const bottom = height - Math.min(height * .34, width < 768 ? 202 : 125);
  const badgeX = clamp(x, 25, width - 25);
  const badgeY = clamp(iconY, top, bottom);
  const offscreen = badgeX !== x || badgeY !== iconY;
  const pulse = .5 + .5 * Math.sin(time * 2.5);

  ctx.save();
  if (cue.action === 'walk' || cue.action === 'pickup' || cue.action === 'approach' || cue.action === 'unload') {
    const px = screenX(player.x);
    const py = screenY(player.y + 14);
    const dx = x - px;
    const dy = y - py;
    const distance = Math.hypot(dx, dy);
    const count = Math.min(4, Math.floor((distance - 16) / 21));
    ctx.fillStyle = '#ffdf9a';
    for (let i = 1; i <= count; i++) {
      ctx.globalAlpha = .34 + .24 * (.5 + .5 * Math.sin(time * 2.8 - i * .85));
      ctx.beginPath();
      ctx.ellipse(px + dx * (i * 21 / distance), py + dy * (i * 21 / distance), 2, 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!offscreen) {
    ctx.globalAlpha = .42 + pulse * .2;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, cue.action === 'pickup' ? 8 : 13, 4.4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffe2a1';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.translate(badgeX, badgeY - pulse * 2);
  ctx.fillStyle = '#493528';
  ctx.strokeStyle = '#d8a870';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawTutorialIcon(ctx, TUTORIAL_ICONS[cue.action]);

  if (offscreen) {
    // Chevron aponta para o destino mesmo quando a câmera não o enquadra.
    ctx.rotate(Math.atan2(iconY - badgeY, x - badgeX));
    ctx.translate(14, 0);
    ctx.beginPath();
    ctx.moveTo(0, -3.5);
    ctx.lineTo(4.5, 0);
    ctx.lineTo(0, 3.5);
    ctx.strokeStyle = '#ffe3ad';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}
