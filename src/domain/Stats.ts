import { GameState, DerivedStats } from './types.ts';

export const BACKPACK_CAPACITIES = [10, 16, 24, 34, 46, 60];

export function getDerivedStats(state: GameState): DerivedStats {
  const u = state.upgrades;
  const spec = state.specialization;

  const maxBackpack = BACKPACK_CAPACITIES[u.backpackSize ?? 0] || 10;
  const toolPower = 1 + (u.toolPower ?? 0);
  const swingSpeedMult = 1 + (u.toolSpeed ?? 0) * 0.16;
  const reachRadius = 78 + (u.toolReach ?? 0) * 15;
  const swingArc = 1.5 + (u.toolReach ?? 0) * 0.18;

  const sweetSpotWindow = 0.23 + (u.sweetSpotMastery ?? 0) * 0.035;
  const critMult = 2.0 + (u.sweetSpotMastery ?? 0) * 0.3;

  const magnetRadius = (85 + (u.magnetCoil ?? 0) * 55) * (spec === 'automataEngineer' ? 1.8 : 1);
  const moveSpeed = (220 + (u.lightBoots ?? 0) * 22) * (spec === 'airshipMagnate' ? 1.2 : 1);
  const dashCooldown = (u.steamDash ?? 0) > 0 ? 0.85 : 1.45;

  const stationSpeedMult = 1 + (u.stationSpeed ?? 0) * 0.25 + (spec === 'artisan' ? 0.6 : 0);
  const doubleYieldChance = Math.min(0.85, (u.doubleYield ?? 0) * 0.12 + (spec === 'artisan' ? 0.25 : 0));
  const merchantMult = 1 + (u.merchantFavor ?? 0) * 0.15 + (spec === 'artisan' ? 0.35 : 0);
  const airshipSpeedMult = spec === 'airshipMagnate' ? 1.54 : 1;
  const airshipRewardMult = spec === 'airshipMagnate' ? 1.35 : 1;

  const droneSpeedMult = 1 + (spec === 'automataEngineer' ? 0.7 : 0) + ((u.relicCelestialCore ?? 0) > 0 ? 0.5 : 0);
  const droneCap = 2 + (spec === 'automataEngineer' ? 2 : 0) + ((u.relicCelestialCore ?? 0) > 0 ? 2 : 0);

  return {
    maxBackpack,
    toolPower,
    swingSpeedMult,
    reachRadius,
    swingArc,
    sweetSpotWindow,
    critMult,
    magnetRadius,
    moveSpeed,
    dashCooldown,
    stationSpeedMult,
    doubleYieldChance,
    merchantMult,
    airshipSpeedMult,
    airshipRewardMult,
    droneSpeedMult,
    droneCap
  };
}
