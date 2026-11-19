export class PlayerSystem {
  triggerDash(player, stats, inputDir) {
    if (player.dashCooldown > 0 || player.dashTimer > 0) {
      return false;
    }

    let dx = inputDir?.dx ?? 0;
    let dy = inputDir?.dy ?? 0;

    if (Math.hypot(dx, dy) < 0.1) {
      dx = Math.cos(player.facing);
      dy = Math.sin(player.facing);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    player.dashDirX = dx;
    player.dashDirY = dy;
    player.dashTimer = 0.18;
    player.dashCooldown = stats.dashCooldown;
    player.moveTarget = null;

    return true;
  }

  triggerSwing(player, stats) {
    if (player.cooldownTimer > 0) {
      return false;
    }

    player.swingDuration = 0.23 / stats.swingSpeedMult;
    player.swingTimer = player.swingDuration;
    player.cooldownTimer = 0.28 / stats.swingSpeedMult;
    player.swingAngleStart = player.facing - stats.swingArc * 0.55;
    player.swingAngleEnd = player.facing + stats.swingArc * 0.55;

    return true;
  }

  update(player, state, stats, dt, input, isPointWalkable, onAutoHitNode) {
    if (player.swingTimer > 0) player.swingTimer = Math.max(0, player.swingTimer - dt);
    if (player.cooldownTimer > 0) player.cooldownTimer = Math.max(0, player.cooldownTimer - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      const spd = 680;
      const nx = player.x + player.dashDirX * spd * dt;
      const ny = player.y + player.dashDirY * spd * dt;
      if (isPointWalkable(state, nx, player.y)) player.x = nx;
      if (isPointWalkable(state, player.x, ny)) player.y = ny;
      return;
    }

    let ix = input.ix;
    let iy = input.iy;

    if (input.hasInput) {
      player.moveTarget = null;
      const mag = Math.hypot(ix, iy);
      ix /= Math.max(1, mag);
      iy /= Math.max(1, mag);
    } else if (player.moveTarget) {
      const dx = player.moveTarget.x - player.x;
      const dy = player.moveTarget.y - player.y;
      const dist = Math.hypot(dx, dy);
      const stopDist = player.moveTarget.autoHitNode ? (stats.reachRadius * 0.75) : 10;

      if (dist <= stopDist) {
        if (player.moveTarget.autoHitNode && !player.moveTarget.autoHitNode.depleted) {
          player.facing = Math.atan2(
            player.moveTarget.autoHitNode.y - player.y,
            player.moveTarget.autoHitNode.x - player.x
          );
          if (onAutoHitNode) {
            onAutoHitNode(player.moveTarget.autoHitNode);
          }
        }
        player.moveTarget = null;
      } else {
        ix = dx / dist;
        iy = dy / dist;
      }
    }

    const targetVx = ix * stats.moveSpeed;
    const targetVy = iy * stats.moveSpeed;
    const accel = Math.min(1, 14 * dt);

    player.vx += (targetVx - player.vx) * accel;
    player.vy += (targetVy - player.vy) * accel;

    const nx = player.x + player.vx * dt;
    const ny = player.y + player.vy * dt;

    if (isPointWalkable(state, nx, player.y)) {
      player.x = nx;
    } else {
      player.vx = 0;
      player.moveTarget = null;
    }

    if (isPointWalkable(state, player.x, ny)) {
      player.y = ny;
    } else {
      player.vy = 0;
      player.moveTarget = null;
    }

    const curSpd = Math.hypot(player.vx, player.vy);
    if (curSpd > 25) {
      player.walkCycle += dt * (curSpd * 0.045);
      player.tilt = (player.vx / stats.moveSpeed) * 0.14;
      if (Math.hypot(ix, iy) > 0.1) {
        player.facing = Math.atan2(iy, ix);
      }
    } else {
      player.tilt *= 0.85;
    }
  }
}
