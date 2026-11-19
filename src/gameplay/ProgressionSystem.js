import { SPECIALIZATIONS } from '../config/specializations.js';
import { PHASES_INFO } from '../config/phases.js';

export class ProgressionSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  advancePhase(state, newPhase) {
    if (newPhase > state.phase) {
      state.phase = newPhase;
      this.eventBus.emit('phase:advanced', { phase: newPhase });
      this.eventBus.emit('save:request', { silent: false });
      this.eventBus.emit('ui:refresh');
      return true;
    }
    return false;
  }

  selectSpecialization(state, specId) {
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

  getCurrentPhaseInfo(phase) {
    return PHASES_INFO.find(p => p.phase === phase) || PHASES_INFO[0];
  }
}
