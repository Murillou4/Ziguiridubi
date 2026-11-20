import { RESOURCES } from '../config/resources.ts';
import type { ResourceId } from '../domain/types.ts';
import { drawResourceIcon } from '../rendering/world-drops.ts';

const iconUrls: Partial<Record<ResourceId, string>> = {};

export function getResourceIconUrl(resource: ResourceId): string {
  const cached = iconUrls[resource];
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(24, 24);
  ctx.scale(2.35, 2.35);
  drawResourceIcon(ctx, resource);
  const url = canvas.toDataURL();
  iconUrls[resource] = url;
  return url;
}

export function resourceIcon(resource: ResourceId, decorative = false): string {
  const name = RESOURCES[resource]?.name;
  if (!name) return '';
  return `<img class="vale-resource-icon" src="${getResourceIconUrl(resource)}" width="20" height="20" alt="${decorative ? '' : name}" title="${name}">`;
}
