"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type AuthCodeRedirectProps = {
  fallbackPath?: string;
};

export function AuthCodeRedirect({
  fallbackPath = "/biblioteca/perfil"
}: AuthCodeRedirectProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [error, setError] = useState<string | null>(null);
  const [hasCode, setHasCode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const authCode = url.searchParams.get("code");
    const next = url.searchParams.get("next") || fallbackPath;
    const mode = url.searchParams.get("mode");

    if (!authCode) return;
    setHasCode(true);

    async function exchangeCode(code: string) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setError(error.message);
        return;
      }

      const destination =
        mode === "reset-password" ? `${next}?mode=reset-password` : next;

      window.location.replace(destination);
    }

    exchangeCode(authCode);
  }, [fallbackPath, supabase]);

  if (!hasCode) return null;

  return (
    <section className="center-card">
      {error ? (
        <span>{error}</span>
      ) : (
        <>
          <LoaderCircle className="spin" size={20} />
          <span>Validando link do Supabase...</span>
        </>
      )}
    </section>
  );
}
