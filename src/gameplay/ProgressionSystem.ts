import { GameState, SpecializationId } from '../domain/types.ts';
import { SPECIALIZATIONS } from '../config/specializations.ts';
import { PHASES_INFO } from '../config/phases.ts';
import { EventBus } from '../core/EventBus.ts';

export class ProgressionSystem {
  constructor(private eventBus: EventBus) {}

  advancePhase(state: GameState, newPhase: number): boolean {
    if (newPhase > state.phase) {
      state.phase = newPhase;
      this.eventBus.emit('phase:advanced', { phase: newPhase });
      this.eventBus.emit('save:request', { silent: false });
      this.eventBus.emit('ui:refresh');
      return true;
    }
    return false;
  }

  selectSpecialization(state: GameState, specId: SpecializationId): boolean {
    if (state.phase < 5) return false;

    state.specialization = specId;
    const sp = SPECIALIZATIONS.find(s => s.id === specId);

    this.eventBus.emit('sound:upgrade');
    if (sp) {
      this.eventBus.emit('ui:toast', { message: `👑 Especialização ativada: ${sp.name}!` });
    }
    this.eventBus.emit('save:request', { silent: false });
    this.eventBus.emit('ui:refresh');

    return true;
  }

  getCurrentPhaseInfo(phase: number) {
    return PHASES_INFO.find(p => p.phase === phase) || PHASES_INFO[0];
  }
}
