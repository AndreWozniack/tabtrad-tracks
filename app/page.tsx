import Link from "next/link";
import {
  Cloud,
  Disc3,
  LibraryBig,
  PlayCircle,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { demoLibrary, featureList, pricingNotes } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AuthCodeRedirect } from "@/components/auth-code-redirect";

export default function HomePage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="page-shell">
      <AuthCodeRedirect fallbackPath="/biblioteca/perfil" />
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Repositório musical para ensaio</span>
          <h1>Organize, reproduza e compartilhe suas gravações.</h1>
          <p className="hero-text">.</p>
          <div className="hero-actions">
            <Link href="/biblioteca/faixas" className="button primary">
              Abrir faixas
            </Link>
            <Link href="/biblioteca/player" className="button secondary">
              Abrir player
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-header">
            <Disc3 size={18} />
            <span>Playlist de ensaio</span>
          </div>
          <ul className="track-list">
            {demoLibrary.slice(0, 4).map((track) => (
              <li key={track.id} className="track-item">
                <div>
                  <strong>{track.title}</strong>
                  <span>
                    {track.group} • {track.duration}
                  </span>
                </div>
                <PlayCircle size={18} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="feature-grid">
        {featureList.map((feature) => (
          <article key={feature.title} className="feature-card">
            <feature.icon size={20} />
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="library-preview" id="biblioteca">
        <div className="section-heading">
          <span className="eyebrow">MVP</span>
          <h2>Como a biblioteca pode funcionar</h2>
        </div>
        <div className="library-table">
          <div className="library-header">
            <span>Faixa</span>
            <span>Grupo</span>
            <span>Tags</span>
            <span>Status</span>
          </div>
          {demoLibrary.map((track) => (
            <div key={track.id} className="library-row">
              <div>
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>
              <span>{track.group}</span>
              <span>{track.tags.join(", ")}</span>
              <span className="pill">{track.visibility}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
