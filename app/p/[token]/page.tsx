import { Music2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PublicPlayButton } from "./public-play-button";

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch {
    return (
      <main className="library-page">
        <p className="status-banner error">Servidor não configurado para acesso público.</p>
      </main>
    );
  }

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, description, visibility")
    .eq("public_share_token", token)
    .eq("visibility", "public")
    .single();

  if (!collection) {
    return (
      <main className="library-page">
        <section className="setup-card">
          <Music2 size={32} />
          <h1>Coleção não encontrada</h1>
          <p>Este link pode ter expirado ou a coleção não é pública.</p>
        </section>
      </main>
    );
  }

  const { data: collectionTracks } = await supabase
    .from("collection_tracks")
    .select("sort_order, tracks(id, title, artist, duration_seconds)")
    .eq("collection_id", collection.id)
    .order("sort_order");

  type TrackItem = { sort_order: number; tracks: { id: string; title: string; artist: string | null; duration_seconds: number | null } | null };
  const items = ((collectionTracks ?? []) as unknown as TrackItem[])
    .filter((item) => item.tracks !== null)
    .sort((a, b) => a.sort_order - b.sort_order);

  const queueItems = items.map((item) => ({
    id: item.tracks!.id,
    title: item.tracks!.title,
    artist: item.tracks!.artist,
    trackId: item.tracks!.id,
    token,
  }));

  return (
    <main className="library-page">
      <section className="library-toolbar">
        <div>
          <span className="eyebrow">Coleção pública</span>
          <h1>{collection.name}</h1>
          {collection.description && <p>{collection.description}</p>}
        </div>
        <span className="eyebrow">{items.length} faixas · via TabTrad</span>
      </section>

      <div className="file-table">
        <div className="file-table-header">
          <span>#</span>
          <span>Título</span>
          <span>Artista</span>
          <span>Duração</span>
          <span></span>
        </div>
        {items.map((item, idx) => (
          <div key={item.tracks!.id} className="file-row">
            <span className="track-idx">{idx + 1}</span>
            <div className="track-title-col">
              <strong>{item.tracks!.title}</strong>
            </div>
            <span className="track-artist">{item.tracks!.artist ?? "—"}</span>
            <span className="track-duration">{formatDuration(item.tracks!.duration_seconds)}</span>
            <div className="track-actions">
              <PublicPlayButton
                trackId={item.tracks!.id}
                token={token}
                track={{ id: item.tracks!.id, title: item.tracks!.title, artist: item.tracks!.artist, audioSrc: "" }}
                queue={queueItems}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
