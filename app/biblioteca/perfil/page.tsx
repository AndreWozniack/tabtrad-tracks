import { LibraryDashboard } from "@/components/library-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function ProfilePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="library-page">
        <section className="setup-card">
          <span className="eyebrow">Configuração pendente</span>
          <h1>Preencha o Supabase antes de abrir o perfil</h1>
          <p>Defina as variáveis em `.env.local` e recarregue a aplicação.</p>
        </section>
      </main>
    );
  }

  return <LibraryDashboard section="profile" />;
}
