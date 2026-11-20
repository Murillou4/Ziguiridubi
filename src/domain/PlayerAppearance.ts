export type PlayerVariant = 'male' | 'female';

export interface PlayerOutfit {
  hair: 'swept' | 'braid';
  headwear: 'strawHat' | 'trailCap' | 'none';
  top: 'fieldVest' | 'trailJacket';
  bottoms: 'charcoal' | 'moss';
  boots: 'leather' | 'suede';
  backpack: 'amber' | 'plum';
  neckwear: 'rustScarf' | 'sageScarf' | 'none';
  accessory: 'tinMug' | 'brassCompass' | 'none';
}

/** As peças omitidas usam os padrões da variante. */
export interface PlayerAppearance extends Partial<PlayerOutfit> {
  variant?: PlayerVariant;
}

export const DEFAULT_PLAYER_OUTFITS: Readonly<Record<PlayerVariant, Readonly<PlayerOutfit>>> = {
  male: {
    hair: 'swept',
    headwear: 'strawHat',
    top: 'fieldVest',
    bottoms: 'charcoal',
    boots: 'leather',
    backpack: 'amber',
    neckwear: 'rustScarf',
    accessory: 'tinMug'
  },
  female: {
    hair: 'braid',
    headwear: 'trailCap',
    top: 'trailJacket',
    bottoms: 'moss',
    boots: 'suede',
    backpack: 'plum',
    neckwear: 'sageScarf',
    accessory: 'brassCompass'
  }
};
