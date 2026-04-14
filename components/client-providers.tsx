"use client";

import { PlayerProvider } from "@/contexts/player-context";
import { PersistentPlayer } from "@/components/persistent-player";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      {children}
      <PersistentPlayer />
    </PlayerProvider>
  );
}
