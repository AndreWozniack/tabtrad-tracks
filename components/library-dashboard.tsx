"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Disc3,
  LoaderCircle,
  LogOut,
  Music2,
  Play,
  Upload,
  UserRound,
  UserRoundPlus
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type TrackRow = {
  id: string;
  title: string;
  artist: string | null;
  notes: string | null;
  storage_bucket: string | null;
  storage_path: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
  created_at: string;
};

type AuthMode = "signin" | "signup" | "forgot-password" | "reset-password";
type LibrarySection = "tracks" | "player" | "profile";

type LibraryDashboardProps = {
  section: LibrarySection;
};

const storageBucket = "tracks";

function formatBytes(bytes: number | null) {
  if (!bytes) return "Tamanho não informado";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds || Number.isNaN(seconds)) return "Duração não informada";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatDate(date: string | null) {
  if (!date) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium"
  }).format(new Date(date));
}

export function LibraryDashboard({ section }: LibraryDashboardProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [artist, setArtist] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const isRecoveryMode = authMode === "reset-password";

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === playingTrackId) ?? null,
    [playingTrackId, tracks]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      setLoadingSession(false);
    }

    loadSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset-password");
        setStatusMessage("Link de recuperação confirmado. Defina sua nova senha.");
      }

      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      setTracks([]);
      setProfile(null);
      return;
    }

    let isMounted = true;

    async function fetchData() {
      setLoadingTracks(true);
      setErrorMessage(null);

      const [{ data: tracksData, error: tracksError }, { data: profileData, error: profileError }] =
        await Promise.all([
          supabase
            .from("tracks")
            .select(
              "id, title, artist, notes, storage_bucket, storage_path, duration_seconds, file_size_bytes, created_at"
            )
            .eq("owner_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("profiles")
            .select("id, display_name, role, created_at")
            .eq("id", userId)
            .single()
        ]);

      if (!isMounted) return;

      if (tracksError) {
        setErrorMessage(tracksError.message);
      } else {
        setTracks((tracksData ?? []) as TrackRow[]);
      }

      if (profileError) {
        setErrorMessage(profileError.message);
      } else {
        const nextProfile = profileData as ProfileRow;
        setProfile(nextProfile);
        setDisplayNameInput(nextProfile.display_name ?? "");
      }

      setLoadingTracks(false);
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [supabase, userId]);

  useEffect(() => {
    async function detectRecoverySession() {
      if (typeof window === "undefined") return;

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const recoveryType = hash.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (recoveryType !== "recovery" || !accessToken || !refreshToken) {
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setAuthMode("reset-password");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setStatusMessage("Sessão de recuperação reconhecida. Defina sua nova senha.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    detectRecoverySession();
  }, [supabase]);

  async function refreshTracks() {
    if (!userId) return;

    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id, title, artist, notes, storage_bucket, storage_path, duration_seconds, file_size_bytes, created_at"
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setTracks((data ?? []) as TrackRow[]);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAuth(true);
    setErrorMessage(null);
    setStatusMessage(null);

    if (authMode === "forgot-password") {
      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/biblioteca/perfil`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setStatusMessage("Email de recuperação enviado. Abra o link e defina a nova senha.");
      }
    } else if (authMode === "reset-password") {
      if (password.length < 6) {
        setErrorMessage("A nova senha precisa ter pelo menos 6 caracteres.");
        setSubmittingAuth(false);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("A confirmação da senha não confere.");
        setSubmittingAuth(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setStatusMessage("Senha atualizada. Agora você já pode entrar normalmente.");
        setSessionEmail(null);
        setUserId(null);
        setPassword("");
        setConfirmPassword("");
        setAuthMode("signin");
        await supabase.auth.signOut();
      }
    } else if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: email.split("@")[0]
          }
        }
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setStatusMessage("Conta criada. Se a confirmação por email estiver ativa, confirme antes de entrar.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setStatusMessage("Login realizado.");
      }
    }

    setSubmittingAuth(false);
  }

  async function handleLogout() {
    setErrorMessage(null);
    setStatusMessage(null);
    setPlayingTrackId(null);
    setAudioUrl(null);
    await supabase.auth.signOut();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || !userId) {
      setErrorMessage("Faça login e escolha um arquivo antes de enviar.");
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const audio = document.createElement("audio");
    const previewUrl = URL.createObjectURL(selectedFile);

    try {
      audio.src = previewUrl;
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => resolve();
      });

      const durationSeconds = Number.isFinite(audio.duration)
        ? Math.round(audio.duration)
        : null;

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("tracks").insert({
        title: title || selectedFile.name.replace(/\.[^/.]+$/, ""),
        artist: artist || null,
        notes: notes || null,
        owner_id: userId,
        storage_provider: "supabase",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        mime_type: selectedFile.type || null,
        file_size_bytes: selectedFile.size,
        duration_seconds: durationSeconds
      });

      if (insertError) throw insertError;

      setStatusMessage("Música enviada com sucesso.");
      setSelectedFile(null);
      setTitle("");
      setArtist("");
      setNotes("");
      await refreshTracks();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao enviar o arquivo."
      );
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploading(false);
    }
  }

  async function handlePlay(track: TrackRow) {
    setErrorMessage(null);
    setStatusMessage(null);
    setAudioUrl(null);

    const bucket = track.storage_bucket ?? storageBucket;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(track.storage_path, 60 * 30);

    if (error || !data?.signedUrl) {
      setErrorMessage(error?.message ?? "Não foi possível gerar a URL de reprodução.");
      return;
    }

    setPlayingTrackId(track.id);
    setAudioUrl(data.signedUrl);
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) return;

    setSavingProfile(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayNameInput || null })
      .eq("id", userId);

    if (error) {
      setErrorMessage(error.message);
      setSavingProfile(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            display_name: displayNameInput || null
          }
        : current
    );
    setStatusMessage("Perfil atualizado.");
    setSavingProfile(false);
  }

  if (loadingSession) {
    return (
      <main className="library-page">
        <section className="center-card">
          <LoaderCircle className="spin" size={20} />
          <span>Carregando sessão...</span>
        </section>
      </main>
    );
  }

  if (!sessionEmail || isRecoveryMode) {
    return (
      <main className="library-page">
        <section className="library-toolbar">
          <div>
            <span className="eyebrow">Acesso</span>
            <h1>Entre para gerenciar seu repertório</h1>
            <p>Autenticação, recuperação de senha e biblioteca conectadas ao Supabase.</p>
          </div>
        </section>

        {statusMessage ? <p className="status-banner success">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

        <section className="auth-layout">
          <form className="auth-card" onSubmit={handleAuthSubmit}>
            <div>
              <span className="eyebrow">Conta</span>
              <h2>
                {authMode === "signin"
                  ? "Entrar"
                  : authMode === "signup"
                    ? "Criar conta"
                    : authMode === "forgot-password"
                      ? "Recuperar senha"
                      : "Nova senha"}
              </h2>
              <p>
                {authMode === "forgot-password"
                  ? "Informe seu email para receber o link de redefinição."
                  : authMode === "reset-password"
                    ? "Defina a nova senha da conta."
                    : "Use email e senha para acessar sua biblioteca."}
              </p>
            </div>

            {authMode !== "reset-password" ? (
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                />
              </label>
            ) : null}

            {authMode !== "forgot-password" ? (
              <label className="field">
                <span>{authMode === "reset-password" ? "Nova senha" : "Senha"}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={authMode === "reset-password" ? "Nova senha" : "Sua senha"}
                  minLength={6}
                  required
                />
              </label>
            ) : null}

            {authMode === "reset-password" ? (
              <label className="field">
                <span>Confirmar senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  minLength={6}
                  required
                />
              </label>
            ) : null}

            <button className="button primary" type="submit" disabled={submittingAuth}>
              {submittingAuth ? (
                <>
                  <LoaderCircle className="spin" size={16} />
                  Processando
                </>
              ) : authMode === "signin" ? (
                "Entrar"
              ) : authMode === "signup" ? (
                <>
                  <UserRoundPlus size={16} />
                  Criar conta
                </>
              ) : authMode === "forgot-password" ? (
                "Enviar email de recuperação"
              ) : (
                "Salvar nova senha"
              )}
            </button>

            {authMode === "signin" ? (
              <>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setAuthMode("signup")}
                >
                  Ainda não tenho conta
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setAuthMode("forgot-password")}
                >
                  Esqueci minha senha
                </button>
              </>
            ) : null}

            {authMode === "signup" ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => setAuthMode("signin")}
              >
                Já tenho conta
              </button>
            ) : null}

            {authMode === "forgot-password" || authMode === "reset-password" ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                Voltar ao login
              </button>
            ) : null}
          </form>

          <article className="setup-card">
            <h3>Estrutura desta área</h3>
            <ul className="plain-list">
              <li>`/biblioteca/faixas` para cadastro e upload.</li>
              <li>`/biblioteca/player` para tocar o repertório.</li>
              <li>`/biblioteca/perfil` para dados da conta.</li>
            </ul>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="library-page">
      <section className="library-toolbar">
        <div>
          <span className="eyebrow">Área privada</span>
          <h1>Seu acervo de ensaio</h1>
          <p>Separei o projeto em páginas próprias para perfil, faixas e reprodução.</p>
        </div>
        <div className="session-card">
          <span>Conectado como</span>
          <strong>{profile?.display_name || sessionEmail}</strong>
          <small>{sessionEmail}</small>
          <button className="button secondary" onClick={handleLogout} type="button">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </section>

      <nav className="section-nav">
        <Link
          href="/biblioteca/faixas"
          className={`nav-pill ${section === "tracks" ? "active" : ""}`}
        >
          <Music2 size={16} />
          Faixas
        </Link>
        <Link
          href="/biblioteca/player"
          className={`nav-pill ${section === "player" ? "active" : ""}`}
        >
          <Disc3 size={16} />
          Player
        </Link>
        <Link
          href="/biblioteca/perfil"
          className={`nav-pill ${section === "profile" ? "active" : ""}`}
        >
          <UserRound size={16} />
          Perfil
        </Link>
      </nav>

      {statusMessage ? <p className="status-banner success">{statusMessage}</p> : null}
      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      {section === "tracks" ? (
        <section className="dashboard-grid">
          <form className="upload-card" onSubmit={handleUpload}>
            <div>
              <span className="eyebrow">Nova música</span>
              <h2>Enviar faixa</h2>
            </div>

            <label className="field">
              <span>Arquivo</span>
              <input type="file" accept="audio/*" onChange={handleFileChange} required />
            </label>

            <label className="field">
              <span>Título</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Nome da faixa"
                required
              />
            </label>

            <label className="field">
              <span>Artista</span>
              <input
                type="text"
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
                placeholder="Opcional"
              />
            </label>

            <label className="field">
              <span>Notas</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Coreografia, turma, observações..."
                rows={4}
              />
            </label>

            <button className="button primary" type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <LoaderCircle className="spin" size={16} />
                  Enviando
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Fazer upload
                </>
              )}
            </button>
          </form>

          <section className="playlist-panel">
            <div className="playlist-header">
              <h2>Biblioteca</h2>
              <span>{loadingTracks ? "Carregando..." : `${tracks.length} músicas`}</span>
            </div>

            {tracks.length === 0 && !loadingTracks ? (
              <p className="empty-state">Nenhuma música cadastrada ainda.</p>
            ) : null}

            <div className="playlist-list">
              {tracks.map((track, index) => (
                <article key={track.id} className="playlist-item real">
                  <span className="playlist-index">{index + 1}</span>
                  <div className="playlist-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist || "Artista não informado"}</span>
                  </div>
                  <div className="playlist-meta">
                    <span>{formatDuration(track.duration_seconds)}</span>
                    <span>{formatBytes(track.file_size_bytes)}</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => handlePlay(track)}
                    type="button"
                    aria-label={`Reproduzir ${track.title}`}
                  >
                    <Play size={16} />
                  </button>
                  {playingTrackId === track.id && audioUrl ? (
                    <span className="playing-indicator">pronta no player</span>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {section === "player" ? (
        <section className="dashboard-grid">
          <article className="player-card">
            <div>
              <span className="eyebrow">Player</span>
              <h2>Reprodução do ensaio</h2>
            </div>
            <p>Escolha uma faixa da lista para gerar uma URL assinada e tocar com segurança.</p>
            {currentTrack ? (
              <div className="current-track">
                <strong>{currentTrack.title}</strong>
                <span>{currentTrack.artist || "Artista não informado"}</span>
                <span>{formatDuration(currentTrack.duration_seconds)}</span>
              </div>
            ) : (
              <div className="player-placeholder">
                <Disc3 size={18} />
                <span>Selecione uma faixa abaixo.</span>
              </div>
            )}
            {audioUrl ? <audio key={audioUrl} controls preload="metadata" src={audioUrl} /> : null}
          </article>

          <section className="playlist-panel">
            <div className="playlist-header">
              <h2>Fila disponível</h2>
              <span>{tracks.length} músicas</span>
            </div>
            <div className="playlist-list">
              {tracks.map((track, index) => (
                <article key={track.id} className="playlist-item real">
                  <span className="playlist-index">{index + 1}</span>
                  <div className="playlist-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist || "Artista não informado"}</span>
                  </div>
                  <div className="playlist-meta">
                    <span>{formatDate(track.created_at)}</span>
                    <span>{formatDuration(track.duration_seconds)}</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => handlePlay(track)}
                    type="button"
                    aria-label={`Tocar ${track.title}`}
                  >
                    <Play size={16} />
                  </button>
                  {playingTrackId === track.id ? (
                    <span className="playing-indicator">tocando</span>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {section === "profile" ? (
        <section className="dashboard-grid">
          <form className="upload-card" onSubmit={handleProfileSave}>
            <div>
              <span className="eyebrow">Perfil</span>
              <h2>Dados da conta</h2>
            </div>

            <label className="field">
              <span>Nome de exibição</span>
              <input
                type="text"
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                placeholder="Seu nome"
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input type="email" value={sessionEmail} readOnly />
            </label>

            <button className="button primary" type="submit" disabled={savingProfile}>
              {savingProfile ? (
                <>
                  <LoaderCircle className="spin" size={16} />
                  Salvando
                </>
              ) : (
                "Salvar perfil"
              )}
            </button>
          </form>

          <article className="player-card">
            <div>
              <span className="eyebrow">Resumo</span>
              <h2>Sua conta</h2>
            </div>
            <div className="profile-summary">
              <div>
                <span>Nome</span>
                <strong>{profile?.display_name || "Não definido"}</strong>
              </div>
              <div>
                <span>Papel</span>
                <strong>{profile?.role || "member"}</strong>
              </div>
              <div>
                <span>Conta criada em</span>
                <strong>{formatDate(profile?.created_at ?? null)}</strong>
              </div>
              <div>
                <span>Total de faixas</span>
                <strong>{tracks.length}</strong>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
