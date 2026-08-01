'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { MusicEngine, MUSIC_STATIONS, type MusicStation } from '../lib/music';

export type MusicPlayerState = {
  trackIndex: number;
  playing: boolean;
  volume: number;
  tracks: MusicStation[];
  play: (index: number) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  setTrack: (index: number) => void;
  setVolume: (value: number) => void;
};

class OasisAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private music: MusicEngine | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private muted = true;
  private musicTrackIndex = 0;
  private musicPlaying = true;
  private musicVolume = 0.5;

  isMuted() {
    return this.muted;
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value ? 0 : 0.14, this.ctx?.currentTime ?? 0, 0.15);
    }
    // If unmuting and the music engine is paused, resume it.
    if (!value && this.music && this.musicPlaying) {
      if (!this.music.playing) this.music.play(this.musicTrackIndex);
    }
  }

  start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;

    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.14;
    this.masterGain.connect(this.ctx.destination);

    this.music = new MusicEngine(this.ctx, this.masterGain);
    this.music.setVolume(this.musicVolume);

    if (!this.muted && this.musicPlaying) {
      this.music.play(this.musicTrackIndex);
    }
  }

  playMusic(index: number) {
    this.musicTrackIndex = ((index % MUSIC_STATIONS.length) + MUSIC_STATIONS.length) % MUSIC_STATIONS.length;
    this.musicPlaying = true;
    if (this.music) {
      this.music.play(this.musicTrackIndex);
    }
  }

  pauseMusic() {
    this.musicPlaying = false;
    if (this.music) {
      this.music.stop();
    }
  }

  resumeMusic() {
    this.musicPlaying = true;
    if (this.music && !this.music.playing) {
      this.music.play(this.musicTrackIndex);
    }
  }

  nextMusicTrack() {
    this.playMusic(this.musicTrackIndex + 1);
  }

  prevMusicTrack() {
    this.playMusic(this.musicTrackIndex - 1);
  }

  setMusicVolume(value: number) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.music) {
      this.music.setVolume(this.musicVolume);
    }
  }

  getMusicTrackIndex() {
    return this.musicTrackIndex;
  }

  getMusicPlaying() {
    return this.musicPlaying;
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  playWarp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 2.8);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 2.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 3.3);
  }

  startEngine() {
    if (!this.ctx || this.muted || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.value = 80;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 220;
    this.engineFilter.Q.value = 0.6;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain!);
    this.engineOsc.start();
  }

  stopEngine() {
    try {
      this.engineOsc?.stop();
    } catch {}
    this.engineOsc?.disconnect();
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.engineOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
  }

  setEngine(speed: number) {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain || this.muted) return;
    const t = this.ctx.currentTime;
    const targetFreq = 80 + Math.min(speed, 12) * 16;
    const targetFilter = 220 + Math.min(speed, 12) * 120;
    const targetGain = 0.005 + Math.min(speed / 12, 1) * 0.055;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.12);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.12);
  }

  playQuestComplete() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C major arpeggio
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.05, t + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 1.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 1.5);
    });
  }

  playScanComplete() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.6);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  playApproach() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 1.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.5);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 2);
  }

  playBoost() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.8);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 0.7);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 1.3);
  }

  dispose() {
    this.stopEngine();
    this.music?.dispose();
    this.masterGain?.disconnect();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.music = null;
  }
}

export function useAudio() {
  const audio = useRef(new OasisAudio());
  const [muted, setMutedState] = useState(false);
  const [musicTrack, setMusicTrack] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(true);
  const [musicVolume, setMusicVolumeState] = useState(0.5);

  useEffect(() => {
    const savedMuted = typeof window !== 'undefined' ? localStorage.getItem('oasis-muted') : null;
    const initialMuted = savedMuted === null ? false : savedMuted === 'true';

    const savedVol = typeof window !== 'undefined' ? localStorage.getItem('oasis-music-volume') : null;
    const initialVol = savedVol === null ? 0.5 : Math.max(0, Math.min(1, parseFloat(savedVol) || 0.5));

    setMutedState(initialMuted);
    setMusicVolumeState(initialVol);

    audio.current.setMuted(initialMuted);
    audio.current.setMusicVolume(initialVol);

    return () => audio.current.dispose();
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-muted', String(value));
    }
    audio.current.setMuted(value);
  }, []);

  const toggle = useCallback(() => setMuted(!muted), [muted, setMuted]);

  const start = useCallback(() => {
    audio.current.start();
  }, []);

  const playWarp = useCallback(() => audio.current.playWarp(), []);
  const playBoost = useCallback(() => audio.current.playBoost(), []);
  const playQuestComplete = useCallback(() => audio.current.playQuestComplete(), []);
  const playScanComplete = useCallback(() => audio.current.playScanComplete(), []);
  const playApproach = useCallback(() => audio.current.playApproach(), []);
  const startEngine = useCallback(() => audio.current.startEngine(), []);
  const stopEngine = useCallback(() => audio.current.stopEngine(), []);
  const setEngine = useCallback((speed: number) => audio.current.setEngine(speed), []);

  const setMusicTrackState = useCallback((index: number) => {
    const wrapped = ((index % MUSIC_STATIONS.length) + MUSIC_STATIONS.length) % MUSIC_STATIONS.length;
    setMusicTrack(wrapped);
    setMusicPlaying(true);
    audio.current.playMusic(wrapped);
  }, []);

  const playMusic = setMusicTrackState;

  const pauseMusic = useCallback(() => {
    setMusicPlaying(false);
    audio.current.pauseMusic();
  }, []);

  const resumeMusic = useCallback(() => {
    setMusicPlaying(true);
    audio.current.resumeMusic();
  }, []);

  const toggleMusic = useCallback(() => {
    if (musicPlaying) {
      pauseMusic();
    } else {
      resumeMusic();
    }
  }, [musicPlaying, pauseMusic, resumeMusic]);

  const nextMusicTrack = useCallback(() => {
    setMusicTrackState(musicTrack + 1);
  }, [musicTrack, setMusicTrackState]);

  const prevMusicTrack = useCallback(() => {
    setMusicTrackState(musicTrack - 1);
  }, [musicTrack, setMusicTrackState]);

  const setMusicVolume = useCallback((value: number) => {
    const v = Math.max(0, Math.min(1, value));
    setMusicVolumeState(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-music-volume', String(v));
    }
    audio.current.setMusicVolume(v);
  }, []);

  const music: MusicPlayerState = {
    trackIndex: musicTrack,
    playing: musicPlaying,
    volume: musicVolume,
    tracks: MUSIC_STATIONS,
    play: playMusic,
    pause: pauseMusic,
    resume: resumeMusic,
    next: nextMusicTrack,
    prev: prevMusicTrack,
    setTrack: playMusic,
    setVolume: setMusicVolume,
  };

  return {
    muted,
    toggle,
    setMuted,
    start,
    playWarp,
    playBoost,
    playQuestComplete,
    playScanComplete,
    playApproach,
    startEngine,
    stopEngine,
    setEngine,
    music,
  };
}

export function AudioToggle({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="rounded-full border border-white/10 bg-black/60 p-2.5 text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
