import type { TutorialAction } from '../domain/Tutorial.ts';
import { drawResourceIcon } from './world-drops.ts';

export type TutorialIcon = 'steps' | 'wood' | 'stone' | 'satchel' | 'build' | 'mouse' | 'joystick' | 'mallet';

export const TUTORIAL_ICONS: Record<TutorialAction, TutorialIcon> = {
  walk: 'steps',
  chop: 'wood',
  mine: 'stone',
  pickup: 'satchel',
  unload: 'satchel',
  approach: 'build',
  inspect: 'build',
  deposit: 'build'
};

const INK = '#3d2c20';
const BRASS = '#e3b678';
const CREAM = '#f8e5b8';
const LEATHER = '#a76e43';

function shape(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  shape(ctx, color);
}

/** Desenha o ícone em torno da origem, em uma área de 24 por 24. */
export function drawTutorialIcon(ctx: CanvasRenderingContext2D, icon: TutorialIcon): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (icon) {
    case 'wood':
    case 'stone':
      drawResourceIcon(ctx, icon);
      break;
    case 'steps':
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 4.5, -side * 3);
        ctx.rotate(side * .26);
        ctx.beginPath();
        ctx.ellipse(0, -.9, 2.8, 4.2, 0, 0, Math.PI * 2);
        shape(ctx, CREAM);
        box(ctx, -1.8, 3.1, 3.6, 3.1, 1.1, BRASS);
        ctx.restore();
      }
      break;
    case 'satchel':
      box(ctx, -3, -10, 6, 5, 1.6, BRASS);
      box(ctx, -8.5, -7, 17, 16, 3.1, LEATHER);
      box(ctx, -8.5, -7, 17, 6.3, 2, BRASS);
      box(ctx, -2, -1.8, 4, 4.2, .8, CREAM);
      break;
    case 'build':
      box(ctx, -9, -5, 18, 13, 1.4, LEATHER);
      ctx.beginPath();
      ctx.moveTo(-9, -1);
      ctx.lineTo(9, -1);
      ctx.moveTo(-9, 4);
      ctx.lineTo(9, 4);
      ctx.stroke();
      box(ctx, -8, -5.5, 3.3, 14, .6, BRASS);
      box(ctx, 4.7, -5.5, 3.3, 14, .6, BRASS);
      ctx.beginPath();
      ctx.moveTo(0, -11.3);
      ctx.lineTo(0, -5.4);
      ctx.moveTo(-2.8, -8.1);
      ctx.lineTo(0, -5.4);
      ctx.lineTo(2.8, -8.1);
      ctx.strokeStyle = CREAM;
      ctx.stroke();
      break;
    case 'mouse':
      box(ctx, -6.25, -9.5, 12.5, 19, 5, CREAM);
      box(ctx, -5.8, -9, 5.8, 7, 1.7, BRASS);
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(6, -2);
      ctx.stroke();
      break;
    case 'joystick':
      ctx.beginPath();
      ctx.ellipse(0, 2.3, 9, 6.1, 0, 0, Math.PI * 2);
      shape(ctx, LEATHER);
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(3.3, -4.6);
      ctx.lineWidth = 2.3;
      ctx.stroke();
      ctx.lineWidth = 1.15;
      box(ctx, .3, -8.7, 6.7, 6.7, 3.3, BRASS);
      break;
    case 'mallet':
      ctx.rotate(.47);
      box(ctx, -1.7, -3.7, 3.4, 13.4, .9, LEATHER);
      box(ctx, -7.4, -7.2, 14.8, 6.4, 1.5, CREAM);
      box(ctx, -7.6, -7.2, 3.2, 6.4, .8, BRASS);
      break;
  }
  ctx.restore();
}
