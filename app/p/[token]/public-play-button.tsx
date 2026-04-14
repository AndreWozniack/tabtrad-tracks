"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { usePlayer } from "@/contexts/player-context";
import type { PlayerTrack } from "@/contexts/player-context";

type Props = {
  trackId: string;
  token: string;
  track: PlayerTrack;
  queue: Array<{ id: string; title: string; artist: string | null; trackId: string; token: string }>;
};

export function PublicPlayButton({ trackId, token, track, queue }: Props) {
  const player = usePlayer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlay() {
    setLoading(true);
    setError(null);

    try {
      // Resolve all queue URLs in parallel
      const resolved = await Promise.all(
        queue.map(async (item) => {
          const res = await fetch(`/api/public/stream?trackId=${item.trackId}&token=${item.token}`);
          if (!res.ok) return null;
          const { url } = await res.json();
          return { id: item.id, title: item.title, artist: item.artist, audioSrc: url } as PlayerTrack;
        })
      );
      const resolvedQueue = resolved.filter((t): t is PlayerTrack => t !== null);
      const target = resolvedQueue.find((t) => t.id === track.id);
      if (!target) { setError("Não foi possível carregar a faixa."); return; }
      player.play(target, resolvedQueue);
    } catch {
      setError("Erro ao carregar faixa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="icon-button" onClick={handlePlay} disabled={loading} aria-label="Reproduzir">
      {loading ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}
