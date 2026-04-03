"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Folder,
  FolderOpen,
  FolderPlus,
  LoaderCircle,
  LogOut,
  Music2,
  Upload,
  UserRound,
  UserRoundPlus,
  X
} from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { createSupabaseBrowserClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type FolderRow = {
  id: string;
  name: string;
  created_at: string;
  collection_tracks: { track_id: string }[];
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
  created_at: string;
};

type AuthMode = "signin" | "signup" | "forgot-password" | "reset-password";
type LibrarySection = "tracks" | "profile";

type LibraryDashboardProps = {
  section: LibrarySection;
};

const storageBucket = "tracks";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null) {
  if (!seconds || Number.isNaN(seconds)) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(date));
}

function makeSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `pasta-${Date.now()}`;
}

function NowPlayingBars() {
  return (
    <div className="now-playing-bars" aria-hidden>
      <span /><span /><span />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryDashboard({ section }: LibraryDashboardProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());

  // auth
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // profile (kept in state because it syncs with the editable form)
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // upload form
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // profile
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // player
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // folders
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [assigningTrackId, setAssigningTrackId] = useState<string | null>(null);
  const folderDropdownRef = useRef<HTMLDivElement | null>(null);

  // feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRecoveryMode = authMode === "reset-password";

  // ── SWR fetchers ───────────────────────────────────────────────────────────

  const tracksKey = userId ? `tracks:${userId}` : null;
  const foldersKey = userId ? `folders:${userId}` : null;

  const { data: tracks = [], isLoading: loadingTracks } = useSWR<TrackRow[]>(
    tracksKey,
    async () => {
      const { data } = await supabase
        .from("tracks")
        .select("id, title, artist, notes, storage_bucket, storage_path, duration_seconds, file_size_bytes, created_at")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as TrackRow[];
    },
    { revalidateOnFocus: true, dedupingInterval: 10_000 }
  );

  const { data: folders = [] } = useSWR<FolderRow[]>(
    foldersKey,
    async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, name, created_at, collection_tracks(track_id)")
        .eq("owner_id", userId!)
        .order("name");
      return (data ?? []) as FolderRow[];
    },
    { revalidateOnFocus: true, dedupingInterval: 10_000 }
  );

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === playingTrackId) ?? null,
    [playingTrackId, tracks]
  );

  const filteredTracks = useMemo(() => {
    if (!activeFolderId) return tracks;
    const folder = folders.find((f) => f.id === activeFolderId);
    if (!folder) return tracks;
    const ids = new Set(folder.collection_tracks.map((ct) => ct.track_id));
    return tracks.filter((t) => ids.has(t.id));
  }, [tracks, folders, activeFolderId]);

  function trackFolderIds(trackId: string) {
    return folders.filter((f) => f.collection_tracks.some((ct) => ct.track_id === trackId)).map((f) => f.id);
  }

  // ── Session ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset-password");
        setStatusMessage("Link de recuperação confirmado. Defina sua nova senha.");
      }
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    async function detectRecovery() {
      if (typeof window === "undefined") return;
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (hash.get("type") !== "recovery") return;
      const at = hash.get("access_token");
      const rt = hash.get("refresh_token");
      if (!at || !rt) return;
      const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      if (error) { setErrorMessage(error.message); return; }
      setAuthMode("reset-password");
      setStatusMessage("Sessão de recuperação reconhecida. Defina sua nova senha.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    detectRecovery();
  }, [supabase]);

  // ── Profile fetch (kept manual — updates display name input on first load) ──

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let alive = true;
    supabase.from("profiles").select("id, display_name, role, created_at").eq("id", userId).single().then(({ data }) => {
      if (!alive || !data) return;
      setProfile(data as ProfileRow);
      setDisplayNameInput(data.display_name ?? "");
    });
    return () => { alive = false; };
  }, [supabase, userId]);

  // Close folder dropdown when clicking outside
  useEffect(() => {
    if (!assigningTrackId) return;
    function onDown(e: MouseEvent) {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(e.target as Node)) {
        setAssigningTrackId(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [assigningTrackId]);

  // ── Cache invalidation helpers ─────────────────────────────────────────────

  function refreshTracks() { return globalMutate(tracksKey); }
  function refreshFolders() { return globalMutate(foldersKey); }

  // ── Auth handlers ──────────────────────────────────────────────────────────

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAuth(true);
    setErrorMessage(null);
    setStatusMessage(null);

    if (authMode === "forgot-password") {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/biblioteca/perfil` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) setErrorMessage(error.message);
      else setStatusMessage("Email de recuperação enviado. Abra o link e defina a nova senha.");
    } else if (authMode === "reset-password") {
      if (password.length < 6) { setErrorMessage("Mínimo 6 caracteres."); setSubmittingAuth(false); return; }
      if (password !== confirmPassword) { setErrorMessage("As senhas não conferem."); setSubmittingAuth(false); return; }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setErrorMessage(error.message);
      else { setStatusMessage("Senha atualizada."); setPassword(""); setConfirmPassword(""); setAuthMode("signin"); await supabase.auth.signOut(); }
    } else if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] } } });
      if (error) setErrorMessage(error.message);
      else setStatusMessage("Conta criada. Confirme seu email se necessário.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMessage(error.message);
    }
    setSubmittingAuth(false);
  }

  async function handleLogout() {
    setPlayingTrackId(null);
    setAudioUrl(null);
    await supabase.auth.signOut();
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || !userId) { setErrorMessage("Faça login e escolha um arquivo."); return; }
    setUploading(true);
    setErrorMessage(null);

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const previewUrl = URL.createObjectURL(selectedFile);
    const audio = document.createElement("audio");

    try {
      audio.src = previewUrl;
      await new Promise<void>((resolve) => { audio.onloadedmetadata = () => resolve(); audio.onerror = () => resolve(); });
      const durationSeconds = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;

      const { error: upErr } = await supabase.storage.from(storageBucket).upload(storagePath, selectedFile, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("tracks").insert({
        title: title || selectedFile.name.replace(/\.[^/.]+$/, ""),
        artist: artist || null,
        notes: notes || null,
        owner_id: userId,
        storage_provider: "supabase",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        mime_type: selectedFile.type || null,
        file_size_bytes: selectedFile.size,
        duration_seconds: durationSeconds,
      });
      if (insErr) throw insErr;

      setStatusMessage("Faixa enviada.");
      setSelectedFile(null); setTitle(""); setArtist(""); setNotes("");
      setShowUpload(false);
      await refreshTracks();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploading(false);
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  async function handlePlay(track: TrackRow) {
    setErrorMessage(null);
    setAudioUrl(null);
    const bucket = track.storage_bucket ?? storageBucket;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(track.storage_path, 60 * 30);
    if (error || !data?.signedUrl) { setErrorMessage(error?.message ?? "Não foi possível gerar a URL."); return; }
    setPlayingTrackId(track.id);
    setAudioUrl(data.signedUrl);
  }

  // ── Folders ────────────────────────────────────────────────────────────────

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !newFolderName.trim()) return;
    setCreatingFolder(true);
    const { error } = await supabase.from("collections").insert({
      name: newFolderName.trim(),
      slug: makeSlug(newFolderName),
      owner_id: userId,
      visibility: "private",
    });
    if (error) { setErrorMessage(error.message); }
    else { setNewFolderName(""); setShowNewFolder(false); await refreshFolders(); }
    setCreatingFolder(false);
  }

  async function handleDeleteFolder(folderId: string, folderName: string) {
    if (!window.confirm(`Excluir a pasta "${folderName}"? As faixas não serão apagadas.`)) return;
    await supabase.from("collection_tracks").delete().eq("collection_id", folderId);
    const { error } = await supabase.from("collections").delete().eq("id", folderId);
    if (error) { setErrorMessage(error.message); return; }
    if (activeFolderId === folderId) setActiveFolderId(null);
    await refreshFolders();
  }

  async function handleToggleTrackInFolder(trackId: string, folderId: string) {
    const folder = folders.find((f) => f.id === folderId);
    const isIn = folder?.collection_tracks.some((ct) => ct.track_id === trackId) ?? false;
    if (isIn) {
      await supabase.from("collection_tracks").delete().eq("collection_id", folderId).eq("track_id", trackId);
    } else {
      await supabase.from("collection_tracks").insert({
        collection_id: folderId,
        track_id: trackId,
        sort_order: folder?.collection_tracks.length ?? 0,
      });
    }
    await refreshFolders();
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setSavingProfile(true);
    setErrorMessage(null);
    const { error } = await supabase.from("profiles").update({ display_name: displayNameInput || null }).eq("id", userId);
    if (error) { setErrorMessage(error.message); }
    else { setProfile((c) => c ? { ...c, display_name: displayNameInput || null } : c); setStatusMessage("Perfil atualizado."); }
    setSavingProfile(false);
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loadingSession) {
    return (
      <main className="auth-page">
        <div className="center-spinner"><LoaderCircle className="spin" size={28} /></div>
      </main>
    );
  }

  // ── Render: auth ───────────────────────────────────────────────────────────

  if (!sessionEmail || isRecoveryMode) {
    return (
      <main className="auth-page">
        <div className="auth-header">
          <span className="app-name">tabTrad</span>
          <p>Seu repertório de ensaio</p>
        </div>
        {statusMessage ? <p className="status-banner success">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <h2 className="auth-title">
            {authMode === "signin" ? "Entrar" : authMode === "signup" ? "Criar conta" : authMode === "forgot-password" ? "Recuperar senha" : "Nova senha"}
          </h2>
          {authMode !== "reset-password" ? (
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" required />
            </label>
          ) : null}
          {authMode !== "forgot-password" ? (
            <label className="field">
              <span>{authMode === "reset-password" ? "Nova senha" : "Senha"}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </label>
          ) : null}
          {authMode === "reset-password" ? (
            <label className="field">
              <span>Confirmar senha</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
            </label>
          ) : null}
          <button className="button primary" type="submit" disabled={submittingAuth}>
            {submittingAuth ? <><LoaderCircle className="spin" size={16} /> Processando</> : authMode === "signin" ? "Entrar" : authMode === "signup" ? <><UserRoundPlus size={16} /> Criar conta</> : authMode === "forgot-password" ? "Enviar link" : "Salvar senha"}
          </button>
          <div className="auth-links">
            {authMode === "signin" ? (<>
              <button className="button secondary" type="button" onClick={() => setAuthMode("signup")}>Criar conta</button>
              <button className="text-button" type="button" onClick={() => setAuthMode("forgot-password")}>Esqueci minha senha</button>
            </>) : null}
            {authMode === "signup" ? <button className="button secondary" type="button" onClick={() => setAuthMode("signin")}>Já tenho conta</button> : null}
            {(authMode === "forgot-password" || authMode === "reset-password") ? <button className="button secondary" type="button" onClick={() => { setAuthMode("signin"); setPassword(""); setConfirmPassword(""); }}>Voltar ao login</button> : null}
          </div>
        </form>
      </main>
    );
  }

  // ── Render: app ────────────────────────────────────────────────────────────

  const displayName = profile?.display_name || sessionEmail.split("@")[0];

  return (
    <>
      <main className={`library-page${audioUrl ? " has-player" : ""}`}>
        {/* Header */}
        <header className="app-header">
          <span className="app-name">tabTrad</span>
          <nav className="app-nav">
            <Link href="/biblioteca/faixas" className={`nav-pill${section === "tracks" ? " active" : ""}`}>
              <Music2 size={15} /> Faixas
            </Link>
            <Link href="/biblioteca/perfil" className={`nav-pill${section === "profile" ? " active" : ""}`}>
              <UserRound size={15} /> Perfil
            </Link>
          </nav>
          <div className="header-user">
            <span className="header-username">{displayName}</span>
            <button className="icon-button" onClick={handleLogout} type="button" aria-label="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {statusMessage ? <p className="status-banner success">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

        {/* ── Tracks ─────────────────────────────────────────────────────── */}
        {section === "tracks" ? (
          <section className="tracks-section">
            <div className="tracks-header">
              <div className="tracks-heading">
                <h1 className="tracks-title">Biblioteca</h1>
                <span className="tracks-count">
                  {loadingTracks ? "carregando…" : `${filteredTracks.length} ${filteredTracks.length === 1 ? "faixa" : "faixas"}${activeFolderId ? "" : ` · ${folders.length} ${folders.length === 1 ? "pasta" : "pastas"}`}`}
                </span>
              </div>
              <button className="button secondary" type="button" onClick={() => setShowUpload((v) => !v)}>
                {showUpload ? <><X size={16} /> Fechar</> : <><Upload size={16} /> Adicionar</>}
              </button>
            </div>

            {/* Upload form */}
            {showUpload ? (
              <form className="upload-form" onSubmit={handleUpload}>
                <label className="field upload-form-file">
                  <span>Arquivo de áudio</span>
                  <input type="file" accept="audio/*" onChange={handleFileChange} required />
                </label>
                <label className="field">
                  <span>Título</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da faixa" required />
                </label>
                <label className="field">
                  <span>Artista</span>
                  <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Opcional" />
                </label>
                <label className="field upload-form-notes">
                  <span>Notas</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Coreografia, turma, observações…" rows={2} />
                </label>
                <div className="upload-form-actions">
                  <button className="button primary" type="submit" disabled={uploading}>
                    {uploading ? <><LoaderCircle className="spin" size={16} /> Enviando</> : <><Upload size={16} /> Enviar faixa</>}
                  </button>
                  <button className="button secondary" type="button" onClick={() => setShowUpload(false)}>Cancelar</button>
                </div>
              </form>
            ) : null}

            {/* Folder bar */}
            <div className="folder-bar">
              <div className="folder-chips">
                <button
                  className={`folder-chip${!activeFolderId ? " active" : ""}`}
                  type="button"
                  onClick={() => setActiveFolderId(null)}
                >
                  Todas
                  <span className="folder-chip-count">{tracks.length}</span>
                </button>

                {folders.map((folder) => (
                  <div key={folder.id} className="folder-chip-wrapper">
                    <button
                      className={`folder-chip${activeFolderId === folder.id ? " active" : ""}`}
                      type="button"
                      onClick={() => setActiveFolderId(activeFolderId === folder.id ? null : folder.id)}
                    >
                      {activeFolderId === folder.id ? <FolderOpen size={13} /> : <Folder size={13} />}
                      {folder.name}
                      <span className="folder-chip-count">{folder.collection_tracks.length}</span>
                    </button>
                    <button
                      className="folder-chip-delete"
                      type="button"
                      onClick={() => handleDeleteFolder(folder.id, folder.name)}
                      aria-label={`Excluir pasta ${folder.name}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {showNewFolder ? (
                  <form className="new-folder-form" onSubmit={handleCreateFolder}>
                    <input
                      className="new-folder-input"
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Nome da pasta"
                      autoFocus
                      required
                    />
                    <button className="button primary new-folder-btn" type="submit" disabled={creatingFolder}>
                      {creatingFolder ? <LoaderCircle className="spin" size={13} /> : <Check size={13} />}
                    </button>
                    <button className="button secondary new-folder-btn" type="button" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>
                      <X size={13} />
                    </button>
                  </form>
                ) : (
                  <button className="folder-chip add-folder" type="button" onClick={() => setShowNewFolder(true)}>
                    <FolderPlus size={13} /> Nova pasta
                  </button>
                )}
              </div>
            </div>

            {/* Track list */}
            {filteredTracks.length === 0 && !loadingTracks ? (
              <div className="empty-library">
                <Music2 size={36} />
                <p>{activeFolderId ? "Nenhuma faixa nesta pasta." : "Nenhuma faixa ainda."}</p>
                {!activeFolderId ? (
                  <button className="button primary" type="button" onClick={() => setShowUpload(true)}>
                    <Upload size={16} /> Adicionar primeira faixa
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="track-list">
                {filteredTracks.map((track, i) => {
                  const isPlaying = playingTrackId === track.id;
                  const inFolderIds = trackFolderIds(track.id);
                  const isAssigning = assigningTrackId === track.id;

                  return (
                    <div key={track.id} className={`track-row${isPlaying ? " playing" : ""}`}>
                      <button
                        className="track-play-area"
                        onClick={() => handlePlay(track)}
                        type="button"
                        aria-label={`Reproduzir ${track.title}`}
                      >
                        <div className="track-num">
                          {isPlaying ? <NowPlayingBars /> : <span>{i + 1}</span>}
                        </div>
                        <div className="track-info">
                          <strong className="track-title">{track.title}</strong>
                          {track.artist ? <span className="track-artist">{track.artist}</span> : null}
                        </div>
                        <span className="track-duration">{formatDuration(track.duration_seconds)}</span>
                      </button>

                      {/* Folder assign button */}
                      <div className="track-folder-wrapper" ref={isAssigning ? folderDropdownRef : null}>
                        <button
                          className={`track-folder-btn${inFolderIds.length > 0 ? " has-folder" : ""}${isAssigning ? " open" : ""}`}
                          type="button"
                          onClick={() => setAssigningTrackId(isAssigning ? null : track.id)}
                          aria-label="Gerenciar pastas"
                        >
                          {inFolderIds.length > 0 ? <FolderOpen size={14} /> : <Folder size={14} />}
                          {inFolderIds.length > 0 ? <span className="folder-badge">{inFolderIds.length}</span> : null}
                        </button>

                        {isAssigning ? (
                          <div className="folder-dropdown">
                            {folders.length === 0 ? (
                              <span className="folder-dropdown-empty">Crie uma pasta primeiro</span>
                            ) : folders.map((f) => {
                              const checked = inFolderIds.includes(f.id);
                              return (
                                <button
                                  key={f.id}
                                  className={`folder-dropdown-item${checked ? " checked" : ""}`}
                                  type="button"
                                  onClick={() => handleToggleTrackInFolder(track.id, f.id)}
                                >
                                  {checked ? <FolderOpen size={13} /> : <Folder size={13} />}
                                  <span>{f.name}</span>
                                  {checked ? <Check size={12} className="folder-check" /> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        {section === "profile" ? (
          <section className="profile-section">
            <form className="profile-form" onSubmit={handleProfileSave}>
              <h1 className="tracks-title">Perfil</h1>
              <label className="field">
                <span>Nome de exibição</span>
                <input type="text" value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)} placeholder="Seu nome" />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={sessionEmail} readOnly />
              </label>
              <button className="button primary" type="submit" disabled={savingProfile}>
                {savingProfile ? <><LoaderCircle className="spin" size={16} /> Salvando</> : "Salvar"}
              </button>
            </form>
            <aside className="profile-summary-card">
              <h2 className="profile-summary-title">Resumo</h2>
              <div className="profile-summary">
                <div className="profile-stat"><span>Nome</span><strong>{profile?.display_name || "Não definido"}</strong></div>
                <div className="profile-stat"><span>Papel</span><strong>{profile?.role || "member"}</strong></div>
                <div className="profile-stat"><span>Membro desde</span><strong>{formatDate(profile?.created_at ?? null)}</strong></div>
                <div className="profile-stat"><span>Faixas</span><strong>{tracks.length}</strong></div>
                <div className="profile-stat"><span>Pastas</span><strong>{folders.length}</strong></div>
              </div>
            </aside>
          </section>
        ) : null}
      </main>

      {/* Fixed player bar */}
      {audioUrl && currentTrack ? (
        <div className="player-bar">
          <div className="player-bar-track">
            <NowPlayingBars />
            <div className="player-bar-info">
              <strong className="player-bar-title">{currentTrack.title}</strong>
              {currentTrack.artist ? <span className="player-bar-artist">{currentTrack.artist}</span> : null}
            </div>
          </div>
          <audio key={audioUrl} controls autoPlay preload="metadata" src={audioUrl} className="player-bar-audio" />
        </div>
      ) : null}
    </>
  );
}
