"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { usePlayer } from "@/contexts/player-context";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function PersistentPlayer() {
  const { currentTrack, isPlaying, volume, speed, currentTime, duration, togglePlay, next, prev, seek, setVolume, setSpeed } = usePlayer();
  const isSeeking = useRef(false);
  const [displayTime, setDisplayTime] = useState(0);

  // Keep display time in sync unless user is dragging scrubber
  useEffect(() => {
    if (!isSeeking.current) setDisplayTime(currentTime);
  }, [currentTime]);

  // Add/remove body padding when player is active
  useEffect(() => {
    if (currentTrack) {
      document.body.classList.add("player-active");
    } else {
      document.body.classList.remove("player-active");
    }
    return () => document.body.classList.remove("player-active");
  }, [currentTrack]);

  return (
    <div className={`persistent-player${currentTrack ? " visible" : ""}`}>
      <div className="pp-track">
        <strong>{currentTrack?.title ?? ""}</strong>
        <span>{currentTrack?.artist ?? ""}</span>
      </div>

      <div className="pp-controls">
        <button className="icon-button" onClick={prev} aria-label="Anterior" disabled={!currentTrack}>
          <SkipBack size={18} />
        </button>
        <button className="icon-button pp-play" onClick={togglePlay} aria-label={isPlaying ? "Pausar" : "Reproduzir"} disabled={!currentTrack}>
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button className="icon-button" onClick={next} aria-label="Próxima" disabled={!currentTrack}>
          <SkipForward size={18} />
        </button>
      </div>

      <div className="pp-scrubber">
        <span className="pp-time">{formatTime(displayTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={displayTime}
          onMouseDown={() => { isSeeking.current = true; }}
          onTouchStart={() => { isSeeking.current = true; }}
          onChange={(e) => setDisplayTime(Number(e.target.value))}
          onMouseUp={(e) => { isSeeking.current = false; seek(Number((e.target as HTMLInputElement).value)); }}
          onTouchEnd={(e) => { isSeeking.current = false; seek(Number((e.target as HTMLInputElement).value)); }}
          className="range-input"
          aria-label="Progresso"
          disabled={!currentTrack}
        />
        <span className="pp-time">{formatTime(duration)}</span>
      </div>

      <div className="pp-volume">
        <button
          className="icon-button"
          onClick={() => setVolume(volume > 0 ? 0 : 1)}
          aria-label={volume === 0 ? "Ativar som" : "Mudo"}
        >
          {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="range-input volume-range"
          aria-label="Volume"
        />
      </div>

      <div className="pp-speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed-pill${speed === s ? " active" : ""}`}
            onClick={() => setSpeed(s)}
            aria-label={`Velocidade ${s}x`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
