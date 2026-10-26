import { Howl, Howler } from 'howler';

const SFX = {
  click: 'audio/click.wav',
  back: 'audio/back.wav',
  join: 'audio/join.wav',
  leave: 'audio/leave.wav',
  countdown: 'audio/countdown.wav',
  go: 'audio/go.wav',
  tag: 'audio/tag.wav',
  tagged: 'audio/tagged.wav',
  freeze: 'audio/freeze.wav',
  rescue: 'audio/rescue.wav',
  win: 'audio/win.wav',
  lose: 'audio/lose.wav',
  footstep: 'audio/footstep.wav',
  error: 'audio/error.wav',
  ready: 'audio/ready.wav'
};

const TRACKS = {
  menu: 'audio/menu-theme.wav',
  game: 'audio/game-theme.wav'
};

export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.sfx = {};
    this.tracks = {};
    this.currentTrack = null;
    this.currentHowl = null;
    this.unlocked = false;
    this.lastFootstep = 0;
    this.loadSfx();
    this.applyVolumes();
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  loadSfx() {
    for (const [name, src] of Object.entries(SFX)) {
      this.sfx[name] = new Howl({
        src: [src],
        preload: true,
        volume: name === 'footstep' ? 0.25 : 0.55,
        onloaderror: () => {}
      });
    }
  }

  unlock() {
    this.unlocked = true;
    if (Howler.ctx?.state === 'suspended') Howler.ctx.resume().catch(() => {});
    if (this.currentTrack) this.startMusic(this.currentTrack, true);
  }

  setSettings(settings) {
    this.settings = settings;
    this.applyVolumes();
  }

  applyVolumes() {
    const master = this.settings.muted ? 0 : Number(this.settings.masterVolume ?? 0.8);
    Howler.volume(master);
    if (this.currentHowl) {
      this.currentHowl.volume((this.settings.musicVolume ?? 0.45) * 0.55);
    }
  }

  play(name, options = {}) {
    if (!this.unlocked || this.settings.muted) return null;
    const howl = this.sfx[name];
    if (!howl) return null;
    const id = howl.play();
    howl.volume((options.volume ?? 0.6) * (this.settings.sfxVolume ?? 0.8));
    if (options.rate) howl.rate(options.rate, id);
    return id;
  }

  uiClick() { this.play('click', { volume: 0.34 }); }
  uiBack() { this.play('back', { volume: 0.36 }); }
  uiJoin() { this.play('join', { volume: 0.46 }); }
  uiLeave() { this.play('leave', { volume: 0.38 }); }
  countdown() { this.play('countdown', { volume: 0.62 }); }
  go() { this.play('go', { volume: 0.7 }); }
  tag() { this.play('tag', { volume: 0.65 }); }
  tagged() { this.play('tagged', { volume: 0.7 }); }
  freeze() { this.play('freeze', { volume: 0.64 }); }
  rescue() { this.play('rescue', { volume: 0.6 }); }
  win() { this.play('win', { volume: 0.72 }); }
  lose() { this.play('lose', { volume: 0.6 }); }
  error() { this.play('error', { volume: 0.4 }); }
  ready() { this.play('ready', { volume: 0.45 }); }

  footstep(sprinting = false) {
    const now = performance.now();
    const gap = sprinting ? 175 : 290;
    if (now - this.lastFootstep < gap) return;
    this.lastFootstep = now;
    this.play('footstep', { volume: sprinting ? 0.36 : 0.24, rate: sprinting ? 1.35 : 1 });
  }

  startMusic(track, force = false) {
    if (!TRACKS[track]) return;
    if (this.currentTrack === track && !force) return;
    if (this.currentHowl) {
      const old = this.currentHowl;
      old.fade(old.volume(), 0, 400);
      setTimeout(() => old.stop(), 450);
    }
    this.currentTrack = track;
    if (!this.tracks[track]) {
      this.tracks[track] = new Howl({
        src: [TRACKS[track]],
        loop: true,
        preload: true,
        volume: 0,
        onloaderror: () => {}
      });
    }
    this.currentHowl = this.tracks[track];
    if (!this.unlocked) return;
    const id = this.currentHowl.play();
    const target = (this.settings.musicVolume ?? 0.45) * 0.55;
    this.currentHowl.volume(0, id);
    this.currentHowl.fade(0, this.settings.muted ? 0 : target, 700, id);
  }

  stopMusic() {
    if (this.currentHowl) {
      const old = this.currentHowl;
      old.fade(old.volume(), 0, 350);
      setTimeout(() => old.stop(), 380);
    }
    this.currentTrack = null;
    this.currentHowl = null;
  }

  setMusicTrack(track) {
    this.startMusic(track);
  }
}
