import Link from "next/link";
import {
  Cloud,
  Disc3,
  LibraryBig,
  PlayCircle,
  Share2,
  ShieldCheck,
  Users
} from "lucide-react";
import { demoLibrary, featureList, pricingNotes } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function HomePage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Repositório musical para ensaio</span>
          <h1>Organize, reproduza e compartilhe suas músicas de dança.</h1>
          <p className="hero-text">
            Estrutura pensada para catálogo por coreografia, acesso com login e
            armazenamento barato em nuvem.
          </p>
          <p className="hero-text">
            Status da integração Supabase: {configured ? "configurado" : "pendente"}.
          </p>
          <div className="hero-actions">
            <Link href="/biblioteca/faixas" className="button primary">
              Abrir faixas
            </Link>
            <Link href="/biblioteca/player" className="button secondary">
              Abrir player
            </Link>
            <a href="#arquitetura" className="button secondary">
              Ver arquitetura
            </a>
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

      <section className="architecture" id="arquitetura">
        <div className="section-heading">
          <span className="eyebrow">Arquitetura recomendada</span>
          <h2>Simples para começar, barata para manter</h2>
        </div>
        <div className="architecture-grid">
          <article className="architecture-card">
            <ShieldCheck size={18} />
            <h3>Usuários</h3>
            <p>Supabase Auth para login por email e convite para equipe.</p>
          </article>
          <article className="architecture-card">
            <LibraryBig size={18} />
            <h3>Catálogo</h3>
            <p>Postgres com músicas, coleções, permissões e links públicos.</p>
          </article>
          <article className="architecture-card">
            <Cloud size={18} />
            <h3>Arquivos</h3>
            <p>Supabase Storage no começo, com opção de migrar para R2.</p>
          </article>
          <article className="architecture-card">
            <Users size={18} />
            <h3>Compartilhamento</h3>
            <p>Bibliotecas privadas, por grupo, ou página pública por link.</p>
          </article>
        </div>
        <div className="pricing-notes">
          {pricingNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
