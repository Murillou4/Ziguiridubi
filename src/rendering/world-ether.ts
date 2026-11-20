type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#373752';
const CRYSTAL_TONES = {
  main: { front: '#9a91c4', shade: '#635b8e', light: '#c8c3e1', crown: '#e5dff4' },
  side: { front: '#8b87b2', shade: '#555376', light: '#ada9d2', crown: '#d0ccea' }
};

function trace(ctx: Ctx, points: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
}

function face(ctx: Ctx, color: string, ...points: number[]): void {
  trace(ctx, points);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawBedrock(ctx: Ctx): void {
  const shell = [-22, -1, -17, -8, -6, -11, 7, -9, 18, -7, 23, -1, 19, 6, 7, 9, -10, 8, -20, 5];
  trace(ctx, shell);
  ctx.fillStyle = '#55596d';
  ctx.fill();
  face(ctx, '#828296', -22, -1, -17, -8, -6, -11, 2, -5, -10, 2);
  face(ctx, '#717489', 2, -5, 7, -9, 18, -7, 23, -1, 10, 2);
  face(ctx, '#606377', -22, -1, -10, 2, 2, -5, 10, 2, 7, 9, -10, 8, -20, 5);
  face(ctx, '#505063', 10, 2, 23, -1, 19, 6, 7, 9);
  trace(ctx, shell);
  ctx.strokeStyle = '#3f4151';
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

const SHARD = [-8.5, -27, -3, -41, 4, -37.5, 9, -27, 7.5, -.9, .5, 3.6, -7.5, 1.4];

function drawShard(
  ctx: Ctx, x: number, y: number, angle: number, scale: number,
  tone: typeof CRYSTAL_TONES.main, damage = 0
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  face(ctx, tone.front, ...SHARD);
  face(ctx, tone.light, -8.5, -27, -3, -41, -1.6, -28, .5, 3.6, -7.5, 1.4);
  face(ctx, tone.shade, 9, -27, 7.5, -.9, .5, 3.6, 3.1, -25, 4, -37.5);
  face(ctx, tone.crown, -8.5, -27, -3, -41, 4, -37.5, 3.1, -25, -1.6, -28);

  trace(ctx, SHARD);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.lineWidth = .85;
  ctx.strokeStyle = '#eee7f4';
  ctx.beginPath();
  ctx.moveTo(-3, -38.3);
  ctx.lineTo(-1.6, -28);
  ctx.lineTo(-.8, -17.3);
  ctx.moveTo(-5.5, -23.2);
  ctx.lineTo(-5, -14.6);
  ctx.stroke();

  if (damage >= .34) {
    ctx.strokeStyle = '#514765';
    ctx.beginPath();
    ctx.moveTo(-7.8, -17);
    ctx.lineTo(-3.5, -14);
    ctx.lineTo(-4, -10.6);
    ctx.lineTo(1, -7.7);
    if (damage >= .66) {
      ctx.lineTo(5, -10.9);
      ctx.lineTo(7.8, -9.2);
      ctx.moveTo(-4, -10.6);
      ctx.lineTo(-1.7, -17.5);
      ctx.lineTo(3.3, -19);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlimmer(ctx: Ctx, x: number, y: number, phase: number): void {
  const glow = Math.max(0, Math.sin(phase)) ** 5;
  if (glow < .02) return;
  const size = 1.1 + 2.4 * glow;
  ctx.save();
  ctx.globalAlpha *= glow * .82;
  face(ctx, '#f9eeff', x, y - size, x + .7, y - .65, x + size * .65, y,
    x + .7, y + .65, x, y + size, x - .7, y + .65, x - size * .65, y, x - .7, y - .65);
  ctx.restore();
}

export function drawEtherDeposit(ctx: Ctx, time: number, phase: number, damage: number): void {
  const lean = Math.sin(phase);
  const pulse = .5 + .5 * Math.sin(time * 1.9 + phase);
  ctx.save();
  ctx.translate(0, 10);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.ellipse(1.5, 5, 25, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(23, 25, 46, .25)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 1, 21.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(164, 153, 220, ${.12 + pulse * .06})`;
  ctx.fill();
  drawBedrock(ctx);

  drawShard(ctx, 6, -3, .27, .75 - lean * .05, CRYSTAL_TONES.side);
  drawShard(ctx, -9, -.8, -.42, .68 + lean * .035, CRYSTAL_TONES.side);
  drawShard(ctx, -1.6, -.1, -.12 + lean * .07, 1.09, CRYSTAL_TONES.main, damage);
  drawShard(ctx, 9.7, 3.2, .53, .61, CRYSTAL_TONES.main);
  drawShard(ctx, -5.9, 4.2, -.27, .34, CRYSTAL_TONES.side);

  face(ctx, '#a69ec2', -16, 2, -13.5, 1.5, -12.6, 3.8, -15.8, 4.9);
  face(ctx, '#a398c1', 12.7, 5, 16.8, 4.2, 18.2, 5.4, 14.1, 6.9);
  drawGlimmer(ctx, -9.8 + lean * 2.6, -38.3, time * 2.16 + phase);
  drawGlimmer(ctx, 17.8, -15.4, time * 2.16 + phase + 2.4);
  ctx.restore();
}
