export const TUTORIAL_STEPS = ['walk', 'wood', 'stone', 'collect', 'deposit', 'done'] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];

export type TutorialAction = 'walk' | 'chop' | 'mine' | 'pickup' | 'unload' | 'approach' | 'inspect' | 'deposit';

export interface TutorialCue {
  action: TutorialAction;
  x: number;
  y: number;
  lift: number;
}
