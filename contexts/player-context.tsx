"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string | null;
  audioSrc: string;
};

type PlayerContextType = {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  isPlaying: boolean;
  volume: number;
  speed: number;
  currentTime: number;
  duration: number;
  play: (track: PlayerTrack, queue: PlayerTrack[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const volumeRef = useRef(1);
  const speedRef = useRef(1);

  const [currentTrack, _setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [queue, _setQueue] = useState<PlayerTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, _setVolume] = useState(1);
  const [speed, _setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const setCurrentTrack = useCallback((track: PlayerTrack | null) => {
    currentTrackRef.current = track;
    _setCurrentTrack(track);
  }, []);

  const setQueue = useCallback((q: PlayerTrack[]) => {
    queueRef.current = q;
    _setQueue(q);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const q = queueRef.current;
      const curr = currentTrackRef.current;
      if (!curr) return;
      const idx = q.findIndex((t) => t.id === curr.id);
      if (idx >= 0 && idx < q.length - 1) {
        const next = q[idx + 1];
        currentTrackRef.current = next;
        _setCurrentTrack(next);
        audio.src = next.audioSrc;
        audio.playbackRate = speedRef.current;
        audio.volume = volumeRef.current;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const play = useCallback(
    (track: PlayerTrack, newQueue: PlayerTrack[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      setQueue(newQueue);
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      audio.src = track.audioSrc;
      audio.playbackRate = speedRef.current;
      audio.volume = volumeRef.current;
      audio.play().catch(() => {});
    },
    [setCurrentTrack, setQueue]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackRef.current) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const next = useCallback(() => {
    const audio = audioRef.current;
    const curr = currentTrackRef.current;
    const q = queueRef.current;
    if (!audio || !curr) return;
    const idx = q.findIndex((t) => t.id === curr.id);
    if (idx >= 0 && idx < q.length - 1) {
      const nextTrack = q[idx + 1];
      currentTrackRef.current = nextTrack;
      _setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setDuration(0);
      audio.src = nextTrack.audioSrc;
      audio.playbackRate = speedRef.current;
      audio.volume = volumeRef.current;
      audio.play().catch(() => {});
    }
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    const curr = currentTrackRef.current;
    const q = queueRef.current;
    if (!audio || !curr) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const idx = q.findIndex((t) => t.id === curr.id);
    if (idx > 0) {
      const prevTrack = q[idx - 1];
      currentTrackRef.current = prevTrack;
      _setCurrentTrack(prevTrack);
      setCurrentTime(0);
      setDuration(0);
      audio.src = prevTrack.audioSrc;
      audio.playbackRate = speedRef.current;
      audio.volume = volumeRef.current;
      audio.play().catch(() => {});
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    _setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    _setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        volume,
        speed,
        currentTime,
        duration,
        play,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        setSpeed,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
