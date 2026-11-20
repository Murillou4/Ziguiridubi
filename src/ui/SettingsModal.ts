import { AudioManager } from '../audio/AudioManager.ts';
import { EventBus } from '../core/EventBus.ts';

export class SettingsModal {
  constructor(
    private audioManager: AudioManager,
    private eventBus: EventBus
  ) {}

  init(onResetConfirmed: () => void): void {
    // 1. Sliders de Volume
    const masterSlider = document.getElementById('volMasterSlider') as HTMLInputElement | null;
    if (masterSlider) {
      masterSlider.addEventListener('input', (e: Event) => {
        const val = Number((e.target as HTMLInputElement).value) / 100;
        this.audioManager.settings.master = val;
        this.audioManager.applyVolumes();
        this.syncSliders();
        this.eventBus.emit('save:request', { silent: true });
      });
    }

    const musicSlider = document.getElementById('volMusicSlider') as HTMLInputElement | null;
    if (musicSlider) {
      musicSlider.addEventListener('input', (e: Event) => {
        const val = Number((e.target as HTMLInputElement).value) / 100;
        this.audioManager.settings.music = val;
        this.audioManager.applyVolumes();
        this.syncSliders();
        this.eventBus.emit('save:request', { silent: true });
      });
    }

    const sfxSlider = document.getElementById('volSfxSlider') as HTMLInputElement | null;
    if (sfxSlider) {
      sfxSlider.addEventListener('input', (e: Event) => {
        const val = Number((e.target as HTMLInputElement).value) / 100;
        this.audioManager.settings.sfx = val;
        this.audioManager.applyVolumes();
        this.syncSliders();
        this.eventBus.emit('save:request', { silent: true });
      });
    }

    // 2. Botões Mute
    const btnMuteMusic = document.getElementById('btnMuteMusic');
    if (btnMuteMusic) {
      btnMuteMusic.addEventListener('click', () => {
        this.audioManager.settings.musicMuted = !this.audioManager.settings.musicMuted;
        this.audioManager.applyVolumes();
        this.syncSliders();
        this.eventBus.emit('save:request', { silent: true });
      });
    }

    const btnMuteSfx = document.getElementById('btnMuteSfx');
    if (btnMuteSfx) {
      btnMuteSfx.addEventListener('click', () => {
        this.audioManager.settings.sfxMuted = !this.audioManager.settings.sfxMuted;
        this.audioManager.applyVolumes();
        this.syncSliders();
        this.eventBus.emit('save:request', { silent: true });
      });
    }

    // 3. Reset Game
    const btnResetAsk = document.getElementById('btnResetAsk');
    const resetBox = document.getElementById('resetConfirmBox');
    const btnResetCancel = document.getElementById('btnResetCancel');
    const btnResetConfirm = document.getElementById('btnResetConfirm');

    if (btnResetAsk && resetBox) {
      btnResetAsk.addEventListener('click', () => resetBox.classList.remove('hidden'));
    }

    if (btnResetCancel && resetBox) {
      btnResetCancel.addEventListener('click', () => resetBox.classList.add('hidden'));
    }

    if (btnResetConfirm && resetBox) {
      btnResetConfirm.addEventListener('click', () => {
        resetBox.classList.add('hidden');
        onResetConfirmed();
      });
    }
  }

  syncSliders(): void {
    const st = this.audioManager.settings;
    this.syncChannel('Master', st.master);
    this.syncChannel('Music', st.music, st.musicMuted);
    this.syncChannel('Sfx', st.sfx, st.sfxMuted);

    const btnM = document.getElementById('btnMuteMusic');
    if (btnM) {
      btnM.textContent = st.musicMuted ? 'Silenciada' : 'Ligada';
      btnM.setAttribute('aria-pressed', String(st.musicMuted));
    }

    const btnS = document.getElementById('btnMuteSfx');
    if (btnS) {
      btnS.textContent = st.sfxMuted ? 'Silenciados' : 'Ligados';
      btnS.setAttribute('aria-pressed', String(st.sfxMuted));
    }
  }

  private syncChannel(channel: 'Master' | 'Music' | 'Sfx', volume: number, muted = false): void {
    const percent = String(Math.round(volume * 100));
    const slider = document.getElementById(`vol${channel}Slider`) as HTMLInputElement | null;
    if (slider) {
      slider.value = percent;
      slider.style.setProperty('--volume', `${percent}%`);
      slider.toggleAttribute('data-muted', muted);
    }
    const output = document.getElementById(`vol${channel}Val`);
    if (output) output.textContent = `${percent}%`;
  }
}
