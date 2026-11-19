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

    const masterSlider = document.getElementById('volMasterSlider') as HTMLInputElement | null;
    const masterVal = document.getElementById('volMasterVal');
    if (masterSlider) masterSlider.value = String(Math.round(st.master * 100));
    if (masterVal) masterVal.textContent = `${Math.round(st.master * 100)}%`;

    const musicSlider = document.getElementById('volMusicSlider') as HTMLInputElement | null;
    const musicVal = document.getElementById('volMusicVal');
    if (musicSlider) musicSlider.value = String(Math.round(st.music * 100));
    if (musicVal) musicVal.textContent = `${Math.round(st.music * 100)}%`;

    const sfxSlider = document.getElementById('volSfxSlider') as HTMLInputElement | null;
    const sfxVal = document.getElementById('volSfxVal');
    if (sfxSlider) sfxSlider.value = String(Math.round(st.sfx * 100));
    if (sfxVal) sfxVal.textContent = `${Math.round(st.sfx * 100)}%`;

    const btnM = document.getElementById('btnMuteMusic');
    if (btnM) {
      btnM.textContent = st.musicMuted ? 'Mutada' : 'Ativa';
      btnM.className = `px-2 py-0.5 rounded text-[10px] cursor-pointer ${
        st.musicMuted ? 'bg-rose-500/30 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'
      }`;
    }

    const btnS = document.getElementById('btnMuteSfx');
    if (btnS) {
      btnS.textContent = st.sfxMuted ? 'Mutados' : 'Ativos';
      btnS.className = `px-2 py-0.5 rounded text-[10px] cursor-pointer ${
        st.sfxMuted ? 'bg-rose-500/30 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'
      }`;
    }
  }
}
