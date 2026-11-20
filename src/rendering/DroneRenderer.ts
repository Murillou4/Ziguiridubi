import type { DroneEntity, DroneKind } from '../domain/types.ts';
import { WAREHOUSE_POSITION } from '../config/buildings.ts';
import { drawResourceIcon } from './world-drops.ts';

type Ctx = CanvasRenderingContext2D;

const INK = '#392b21';
const BRASS = '#cc9a59';
const GOLD = '#f3d39a';
const COPPER = '#8e5e3b';
const WOOD = '#97633c';
const STEEL = '#a19a85';

const ENAMEL: Record<DroneKind, { base: string; light: string; dark: string }> = {
  lumber: { base: '#73805a', light: '#a4a77a', dark: '#51593f' },
  miner: { base: '#687e77', light: '#9aa89a', dark: '#485954' },
  iron: { base: '#965e49', light: '#c68a67', dark: '#694333' },
  crystal: { base: '#807092', light: '#b4a1c3', dark: '#554660' }
};

function finish(ctx: Ctx, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.15;
  ctx.stroke();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  finish(ctx, color);
}

function disk(ctx: Ctx, x: number, y: number, radius: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  finish(ctx, color);
}

function drawSteam(ctx: Ctx, time: number): void {
  ctx.save();
  ctx.fillStyle = '#f4ead4';
  for (let i = 0; i < 3; i++) {
    const age = (time * .93 + i / 3) % 1;
    ctx.globalAlpha = (1 - age) * .35 * Math.min(1, age * 8);
    ctx.beginPath();
    ctx.ellipse(-13 - age * 10, -16 - age * 9, 1.4 + age * 3, 1.3 + age * 2, -.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRotor(ctx: Ctx, phase: number): void {
  ctx.save();
  ctx.translate(-1.5, -20);
  ctx.beginPath();
  ctx.ellipse(0, 0, 23, 5.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(241, 224, 182, .12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(253, 232, 188, .38)';
  ctx.lineWidth = .9;
  ctx.stroke();

  for (const side of [-1, 1]) {
    const dx = Math.cos(phase) * 21 * side;
    const dy = Math.sin(phase) * 4.65 * side;
    ctx.beginPath();
    ctx.moveTo(dx * .13, dy * .13);
    ctx.quadraticCurveTo(dx * .78, dy * .78 - 2, dx, dy);
    ctx.quadraticCurveTo(dx * 1.06, dy + 1.4, dx * .84, dy + 1.7);
    ctx.lineTo(dx * .13, dy * .13 + .9);
    ctx.closePath();
    ctx.fillStyle = side === 1 ? GOLD : BRASS;
    ctx.fill();
  }
  disk(ctx, 0, 0, 2.1, GOLD);
  ctx.restore();
}

function drawToolArm(ctx: Ctx, kind: DroneKind, working: boolean, workTimer: number): void {
  const stroke = working ? Math.sin(Math.PI * (1 - Math.min(1, Math.max(0, workTimer) / .34))) : 0;
  const jointX = 13 + stroke * 4;
  const jointY = 7 + stroke * 2;
  const tipX = 18 + stroke * 7;
  const tipY = 5 + stroke * 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.stroke();
  ctx.strokeStyle = COPPER;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  disk(ctx, jointX, jointY, 2.1, BRASS);

  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(-.26 + stroke * .56);
  ctx.beginPath();
  if (kind === 'lumber') {
    // Serra curta com dentes recortados.
    ctx.moveTo(-2, -2.5);
    ctx.lineTo(7.9, -2);
    ctx.quadraticCurveTo(9.3, -1.4, 8.7, 1.3);
    ctx.lineTo(7.4, 3.4);
    ctx.lineTo(6, 1.9);
    ctx.lineTo(4.6, 3.6);
    ctx.lineTo(3.1, 2);
    ctx.lineTo(1.6, 3.45);
    ctx.lineTo(.35, 1.8);
    ctx.lineTo(-1.8, 2);
  } else {
    // Ponteiro curvo da mini-picareta.
    ctx.moveTo(-2, -.6);
    ctx.quadraticCurveTo(1.6, -4.7, 7, -4.8);
    ctx.quadraticCurveTo(9.4, -3.5, 9.6, 2.6);
    ctx.quadraticCurveTo(7.3, -.6, 5.5, -1.05);
    ctx.lineTo(2, 1.4);
    ctx.lineTo(-2, .8);
  }
  ctx.closePath();
  const toolMetal = kind === 'iron' ? '#bfa58d' : kind === 'crystal' ? '#cabee0' : STEEL;
  finish(ctx, toolMetal);
  ctx.restore();
}

function drawCargo(ctx: Ctx, drone: DroneEntity): void {
  if (!drone.cargo.length) return;
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(-8, 7);
  ctx.lineTo(-10, 17);
  ctx.moveTo(7, 7);
  ctx.lineTo(9, 17);
  ctx.stroke();
  panel(ctx, -10.5, 15, 20.5, 9, 2.3, WOOD);
  ctx.save();
  ctx.translate(drone.cargo.length > 1 ? -4.8 : -.4, 15.8);
  ctx.scale(.47, .47);
  drawResourceIcon(ctx, drone.cargo[0]);
  if (drone.cargo.length > 1) {
    ctx.translate(17.5, -1.6);
    drawResourceIcon(ctx, drone.cargo[1]);
  }
  ctx.restore();
  panel(ctx, -10.5, 19.2, 20.5, 4.8, 1.6, COPPER);
  ctx.fillStyle = BRASS;
  ctx.fillRect(-8.6, 19.9, 1.5, 3.2);
  ctx.fillRect(6.1, 19.9, 1.5, 3.2);
}

function drawBody(ctx: Ctx, drone: DroneEntity, time: number): void {
  const enamel = ENAMEL[drone.kind];

  // Chaminé, eixo e esquis fazem parte da silhueta mesmo de longe.
  panel(ctx, -14.5, -13.8, 4.2, 9.6, 1, COPPER);
  panel(ctx, -15.5, -15.4, 6.2, 2.7, .75, BRASS);
  panel(ctx, -3.4, -20, 3.8, 9, .9, BRASS);
  ctx.beginPath();
  ctx.moveTo(-11, 7);
  ctx.lineTo(-13, 13.4);
  ctx.lineTo(10.5, 13.4);
  ctx.quadraticCurveTo(12.5, 13.4, 13.7, 11);
  ctx.moveTo(6.4, 7);
  ctx.lineTo(7.8, 13.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 1.35;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-15, -6.5);
  ctx.quadraticCurveTo(-13.9, -12.3, -4.9, -13);
  ctx.quadraticCurveTo(10, -14.2, 15.7, -8.5);
  ctx.quadraticCurveTo(19.4, -4.6, 16.3, 2.6);
  ctx.quadraticCurveTo(13, 7.1, 3, 7.6);
  ctx.lineTo(-9.6, 7.6);
  ctx.quadraticCurveTo(-17, 5.6, -15, -6.5);
  ctx.closePath();
  finish(ctx, enamel.dark);

  ctx.save();
  ctx.clip();
  ctx.fillStyle = enamel.base;
  ctx.beginPath();
  ctx.ellipse(-1.5, -5, 19, 9.7, -.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = enamel.light;
  ctx.beginPath();
  ctx.ellipse(-7, -10.2, 5.3, 1.4, -.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  panel(ctx, -13.7, 2.3, 25, 6.6, 2.3, WOOD);
  ctx.strokeStyle = '#be8a56';
  ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.moveTo(-11.7, 5.4);
  ctx.lineTo(8.7, 5.4);
  ctx.stroke();
  panel(ctx, -9.3, 1.9, 2.7, 7.4, .75, BRASS);
  panel(ctx, 5.6, 1.9, 2.7, 7.4, .75, BRASS);

  panel(ctx, 1.3, -11.1, 11.7, 10.8, 3.4, BRASS);
  panel(ctx, 3, -9.45, 8.4, 7.3, 2.6, '#3f473d');
  ctx.fillStyle = '#98b09c';
  ctx.beginPath();
  ctx.ellipse(5.85, -6.95, 1.75, .95, -.5, 0, Math.PI * 2);
  ctx.fill();
  panel(ctx, -10.4, -7.2, 7.4, 5.8, 1.4, COPPER);
  ctx.fillStyle = '#63432d';
  for (let i = 0; i < 3; i++) ctx.fillRect(-9.2 + i * 1.75, -6, .75, 3.45);
  disk(ctx, 15.4, -.1, 2.8, BRASS);
  ctx.save();
  ctx.fillStyle = '#ffe2a3';
  ctx.globalAlpha *= .75 + .18 * Math.sin(time * 3);
  ctx.beginPath();
  ctx.arc(15.7, -.5, 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class DroneRenderer {
  private readonly heading = new WeakMap<DroneEntity, number>();

  renderDrones(ctx: Ctx, drones: readonly DroneEntity[], worldTime: number): void {
    for (const drone of drones) {
      const working = drone.state === 'harvest';
      const destination = drone.state === 'return' ? WAREHOUSE_POSITION : drone.targetNode;
      const dx = destination ? destination.x - drone.x : 0;
      const facing = Math.abs(dx) > 3 ? Math.sign(dx) : this.heading.get(drone) ?? 1;
      this.heading.set(drone, facing);
      const bob = Math.sin(drone.bobPhase) * (working ? 1.4 : 2.8);

      ctx.save();
      ctx.translate(drone.x, drone.y);
      ctx.fillStyle = 'rgba(29, 24, 16, .23)';
      ctx.beginPath();
      ctx.ellipse(1.5, 26, 12 + bob * .3, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, bob);
      ctx.scale(facing, 1);
      ctx.rotate(working ? .06 : Math.sin(drone.bobPhase) * .053 - .04);
      const time = worldTime + drone.bobPhase * .28;
      drawSteam(ctx, time);
      drawCargo(ctx, drone);
      drawToolArm(ctx, drone.kind, working, drone.workTimer);
      drawBody(ctx, drone, time);
      drawRotor(ctx, time * 29);
      ctx.restore();
    }
  }
}
