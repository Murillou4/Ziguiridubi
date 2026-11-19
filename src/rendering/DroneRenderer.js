import { RESOURCES } from '../config/resources.js';

export class DroneRenderer {
  renderDrones(ctx, drones, worldTime) {
    drones.forEach(drone => {
      const bob = Math.sin(drone.bobPhase) * 4;
      ctx.save();
      ctx.translate(drone.x, drone.y + bob);

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 26 - bob, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = drone.kind === 'lumber' ? '#d97706' : '#0284c7';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      const propW = Math.sin(worldTime * 35) * 14;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-propW, -12);
      ctx.lineTo(propW, -12);
      ctx.stroke();

      if (drone.cargo.length > 0) {
        ctx.fillStyle = RESOURCES[drone.cargo[0]].color;
        ctx.beginPath();
        ctx.arc(0, 12, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }
}
