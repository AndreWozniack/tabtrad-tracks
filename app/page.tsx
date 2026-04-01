import Link from "next/link";
import { Music2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="landing-page">
      <div className="landing-card">
        <div className="landing-icon">
          <Music2 size={28} />
        </div>
        <h1 className="landing-title">tabTrad</h1>
        <p className="landing-subtitle">Repertório de ensaio para grupos de dança</p>
        <Link href="/biblioteca/faixas" className="button primary landing-cta">
          Entrar na biblioteca
        </Link>
      </div>
    </main>
  );
}
