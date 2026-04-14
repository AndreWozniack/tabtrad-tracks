"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Disc3,
  FolderClosed,
  FolderCog,
  FolderPlus,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Music2,
  Share2,
  Trash2,
  Upload,
  UserRound,
  UserRoundPlus,
  X,
} from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { usePlayer, PlayerTrack } from "@/contexts/player-context";

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

type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "team" | "public";
  public_share_token: string | null;
  created_at: string;
};

type CollectionTrackRow = {
  id: string;
  collection_id: string;
  track_id: string;
  sort_order: number;
};

type ProfileRow = {
  id: string;
  email: string | null;
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
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
    new Date(date)
  );
}

function makeSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || `categoria-${Date.now()}`
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryDashboard({ section }: LibraryDashboardProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const player = usePlayer();

  // auth
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // profile
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // upload form
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);

  // collections
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionVisibility, setCollectionVisibility] = useState<
    "private" | "team" | "public"
  >("private");
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isEditCollectionOpen, setIsEditCollectionOpen] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);

  // share collection
  const [isShareCollectionOpen, setIsShareCollectionOpen] = useState(false);
  const [shareCollectionId, setShareCollectionId] = useState<string | null>(
    null
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<
    "viewer" | "editor"
  >("viewer");
  const [inviting, setInviting] = useState(false);

  // context menus
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<
    string | null
  >(null);
  const [openTrackMenuId, setOpenTrackMenuId] = useState<string | null>(null);

  // drag and drop
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropCollectionId, setDropCollectionId] = useState<string | null>(null);

  // busy track (optimistic loading state)
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);

  // feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRecoveryMode = authMode === "reset-password";

  // ── SWR fetchers ───────────────────────────────────────────────────────────

  const tracksKey = userId ? `tracks:${userId}` : null;
  const collectionsKey = userId ? `collections:${userId}` : null;
  const collectionTracksKey = userId ? `collection_tracks:${userId}` : null;

  const { data: tracks = [], isLoading: loadingLibrary } = useSWR<TrackRow[]>(
    tracksKey,
    async () => {
      const { data } = await supabase
        .from("tracks")
        .select(
          "id, title, artist, notes, storage_bucket, storage_path, duration_seconds, file_size_bytes, created_at"
        )
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as TrackRow[];
    },
    { revalidateOnFocus: true, dedupingInterval: 10_000 }
  );

  const { data: collections = [] } = useSWR<CollectionRow[]>(
    collectionsKey,
    async () => {
      const { data } = await supabase
        .from("collections")
        .select(
          "id, name, description, visibility, public_share_token, created_at"
        )
        .eq("owner_id", userId!)
        .order("name");
      return (data ?? []) as CollectionRow[];
    },
    { revalidateOnFocus: true, dedupingInterval: 10_000 }
  );

  const { data: collectionTracks = [] } = useSWR<CollectionTrackRow[]>(
    collectionTracksKey,
    async () => {
      const { data } = await supabase
        .from("collection_tracks")
        .select("id, collection_id, track_id, sort_order")
        .order("sort_order");
      return (data ?? []) as CollectionTrackRow[];
    },
    { revalidateOnFocus: true, dedupingInterval: 10_000 }
  );

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedCollection = useMemo(
    () =>
      selectedCollectionId
        ? (collections.find((c) => c.id === selectedCollectionId) ?? null)
        : null,
    [collections, selectedCollectionId]
  );

  const visibleTracks = useMemo(() => {
    if (!selectedCollectionId) return tracks;
    const ids = collectionTracks
      .filter((ct) => ct.collection_id === selectedCollectionId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ct) => ct.track_id);
    return ids
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is TrackRow => t != null);
  }, [tracks, collectionTracks, selectedCollectionId]);

  // ── Session ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return;
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      setLoadingSession(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset-password");
        setStatusMessage(
          "Link de recuperação confirmado. Defina sua nova senha."
        );
      }
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    async function detectRecovery() {
      if (typeof window === "undefined") return;
      const hash = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      if (hash.get("type") !== "recovery") return;
      const at = hash.get("access_token");
      const rt = hash.get("refresh_token");
      if (!at || !rt) return;
      const { error } = await supabase.auth.setSession({
        access_token: at,
        refresh_token: rt,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setAuthMode("reset-password");
      setStatusMessage(
        "Sessão de recuperação reconhecida. Defina sua nova senha."
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    detectRecovery();
  }, [supabase]);

  // ── Profile fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let alive = true;
    supabase
      .from("profiles")
      .select("id, display_name, role, created_at")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!alive || !data) return;
        setProfile(data as ProfileRow);
        setDisplayNameInput(data.display_name ?? "");
      });
    return () => {
      alive = false;
    };
  }, [supabase, userId]);

  // Close context menus on outside click
  useEffect(() => {
    function onDown() {
      setOpenCollectionMenuId(null);
      setOpenTrackMenuId(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Cache invalidation helpers ─────────────────────────────────────────────

  function refreshTracks() {
    return globalMutate(tracksKey);
  }
  function refreshCollections() {
    return globalMutate(collectionsKey);
  }
  function refreshCollectionTracks() {
    return globalMutate(collectionTracksKey);
  }
  function refreshLibrary() {
    return Promise.all([
      refreshTracks(),
      refreshCollections(),
      refreshCollectionTracks(),
    ]);
  }

  // ── Auth handlers ──────────────────────────────────────────────────────────

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingAuth(true);
    setErrorMessage(null);
    setStatusMessage(null);

    if (authMode === "forgot-password") {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/biblioteca/perfil`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) setErrorMessage(error.message);
      else
        setStatusMessage(
          "Email de recuperação enviado. Abra o link e defina a nova senha."
        );
    } else if (authMode === "reset-password") {
      if (password.length < 6) {
        setErrorMessage("Mínimo 6 caracteres.");
        setSubmittingAuth(false);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("As senhas não conferem.");
        setSubmittingAuth(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setErrorMessage(error.message);
      else {
        setStatusMessage("Senha atualizada.");
        setPassword("");
        setConfirmPassword("");
        setAuthMode("signin");
        await supabase.auth.signOut();
      }
    } else if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: email.split("@")[0] } },
      });
      if (error) setErrorMessage(error.message);
      else
        setStatusMessage("Conta criada. Confirme seu email se necessário.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setErrorMessage(error.message);
    }
    setSubmittingAuth(false);
  }

  async function handleLogout() {
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
    if (!selectedFile || !userId) {
      setErrorMessage("Faça login e escolha um arquivo.");
      return;
    }
    setUploading(true);
    setErrorMessage(null);

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const previewUrl = URL.createObjectURL(selectedFile);
    const audio = document.createElement("audio");

    try {
      audio.src = previewUrl;
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => resolve();
      });
      const durationSeconds = Number.isFinite(audio.duration)
        ? Math.round(audio.duration)
        : null;

      const { error: upErr } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });
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

      // If a collection is selected, add the track to it
      if (selectedCollectionId) {
        const { data: inserted } = await supabase
          .from("tracks")
          .select("id")
          .eq("storage_path", storagePath)
          .single();
        if (inserted) {
          const maxOrder = collectionTracks
            .filter((ct) => ct.collection_id === selectedCollectionId)
            .reduce((max, ct) => Math.max(max, ct.sort_order), -1);
          await supabase.from("collection_tracks").insert({
            collection_id: selectedCollectionId,
            track_id: inserted.id,
            sort_order: maxOrder + 1,
          });
        }
      }

      setStatusMessage("Faixa enviada.");
      setSelectedFile(null);
      setTitle("");
      setArtist("");
      setNotes("");
      setIsAddTrackOpen(false);
      await refreshLibrary();
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
    setBusyTrackId(track.id);
    const bucket = "tracks";

    try {
      // Generate signed URLs for all visible tracks in parallel
      const results = await Promise.all(
        visibleTracks.map(async (t) => {
          const { data } = await supabase.storage
            .from(t.storage_bucket ?? bucket)
            .createSignedUrl(t.storage_path, 60 * 30);
          if (!data?.signedUrl) return null;
          return {
            id: t.id,
            title: t.title,
            artist: t.artist,
            audioSrc: data.signedUrl,
          } as PlayerTrack;
        })
      );

      const resolvedQueue = results.filter(
        (t): t is PlayerTrack => t !== null
      );
      const target = resolvedQueue.find((t) => t.id === track.id);
      if (!target) {
        setErrorMessage("Não foi possível reproduzir esta faixa.");
        return;
      }

      player.play(target, resolvedQueue);
    } finally {
      setBusyTrackId(null);
    }
  }

  // ── Collections ────────────────────────────────────────────────────────────

  async function handleCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !collectionName.trim()) return;
    setCreatingCollection(true);
    const { error } = await supabase.from("collections").insert({
      name: collectionName.trim(),
      description: collectionDescription.trim() || null,
      slug: makeSlug(collectionName),
      owner_id: userId,
      visibility: collectionVisibility,
    });
    if (error) {
      setErrorMessage(error.message);
    } else {
      setCollectionName("");
      setCollectionDescription("");
      setCollectionVisibility("private");
      setIsCreateCollectionOpen(false);
      await refreshCollections();
    }
    setCreatingCollection(false);
  }

  async function handleEditCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCollectionId || !collectionName.trim()) return;
    setSavingCollection(true);
    const { error } = await supabase
      .from("collections")
      .update({
        name: collectionName.trim(),
        description: collectionDescription.trim() || null,
        visibility: collectionVisibility,
      })
      .eq("id", selectedCollectionId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setIsEditCollectionOpen(false);
      await refreshCollections();
    }
    setSavingCollection(false);
  }

  async function handleDeleteCollection(collectionId: string) {
    if (
      !window.confirm(
        "Excluir esta categoria? As faixas não serão apagadas."
      )
    )
      return;
    await supabase
      .from("collection_tracks")
      .delete()
      .eq("collection_id", collectionId);
    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", collectionId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (selectedCollectionId === collectionId) setSelectedCollectionId("");
    await refreshCollections();
    await refreshCollectionTracks();
  }

  // ── Track ↔ Collection ─────────────────────────────────────────────────────

  async function handleAddToCollection(
    collectionId: string,
    trackId: string
  ) {
    const existing = collectionTracks.filter(
      (ct) => ct.collection_id === collectionId
    );
    const alreadyIn = existing.some((ct) => ct.track_id === trackId);
    if (alreadyIn) return;
    const maxOrder = existing.reduce(
      (max, ct) => Math.max(max, ct.sort_order),
      -1
    );
    const { error } = await supabase.from("collection_tracks").insert({
      collection_id: collectionId,
      track_id: trackId,
      sort_order: maxOrder + 1,
    });
    if (error) setErrorMessage(error.message);
    else await refreshCollectionTracks();
  }

  async function handleRemoveFromCollection(
    collectionId: string,
    trackId: string
  ) {
    const { error } = await supabase
      .from("collection_tracks")
      .delete()
      .eq("collection_id", collectionId)
      .eq("track_id", trackId);
    if (error) setErrorMessage(error.message);
    else await refreshCollectionTracks();
  }

  // ── Sort (up/down within collection) ──────────────────────────────────────

  async function handleMoveTrack(trackId: string, direction: "up" | "down") {
    if (!selectedCollectionId) return;
    const items = collectionTracks
      .filter((ct) => ct.collection_id === selectedCollectionId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = items.findIndex((ct) => ct.track_id === trackId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const a = items[idx];
    const b = items[swapIdx];

    await Promise.all([
      supabase
        .from("collection_tracks")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id),
      supabase
        .from("collection_tracks")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id),
    ]);
    await refreshCollectionTracks();
  }

  // ── Delete track ───────────────────────────────────────────────────────────

  async function handleDeleteTrack(
    trackId: string,
    storagePath: string,
    storageBkt: string | null
  ) {
    if (!window.confirm("Excluir esta faixa permanentemente?")) return;
    await supabase.storage
      .from(storageBkt ?? storageBucket)
      .remove([storagePath]);
    await supabase
      .from("collection_tracks")
      .delete()
      .eq("track_id", trackId);
    const { error } = await supabase
      .from("tracks")
      .delete()
      .eq("id", trackId);
    if (error) setErrorMessage(error.message);
    else await refreshLibrary();
  }

  // ── Invite member ──────────────────────────────────────────────────────────

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareCollectionId || !inviteEmail.trim()) return;
    setInviting(true);
    setErrorMessage(null);
    const { error } = await supabase.rpc("invite_user_to_collection", {
      target_collection_id: shareCollectionId,
      target_email: inviteEmail.trim(),
      target_permission: invitePermission,
    });
    if (error) {
      setErrorMessage(error.message);
    } else {
      setStatusMessage(`Convite enviado para ${inviteEmail}.`);
      setInviteEmail("");
      setIsShareCollectionOpen(false);
    }
    setInviting(false);
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setSavingProfile(true);
    setErrorMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayNameInput || null })
      .eq("id", userId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setProfile((c) =>
        c ? { ...c, display_name: displayNameInput || null } : c
      );
      setStatusMessage("Perfil atualizado.");
    }
    setSavingProfile(false);
  }

  // ── Share URL helper ───────────────────────────────────────────────────────

  function getShareUrl(token: string | null) {
    if (!token || typeof window === "undefined") return "";
    return `${window.location.origin}/p/${token}`;
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loadingSession) {
    return (
      <main className="auth-page">
        <div className="center-spinner">
          <LoaderCircle className="spin" size={28} />
        </div>
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
        {statusMessage ? (
          <p className="status-banner success">{statusMessage}</p>
        ) : null}
        {errorMessage ? (
          <p className="status-banner error">{errorMessage}</p>
        ) : null}
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <h2 className="auth-title">
            {authMode === "signin"
              ? "Entrar"
              : authMode === "signup"
              ? "Criar conta"
              : authMode === "forgot-password"
              ? "Recuperar senha"
              : "Nova senha"}
          </h2>
          {authMode !== "reset-password" ? (
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </label>
          ) : null}
          {authMode !== "forgot-password" ? (
            <label className="field">
              <span>
                {authMode === "reset-password" ? "Nova senha" : "Senha"}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
          ) : null}
          <button
            className="button primary"
            type="submit"
            disabled={submittingAuth}
          >
            {submittingAuth ? (
              <>
                <LoaderCircle className="spin" size={16} /> Processando
              </>
            ) : authMode === "signin" ? (
              "Entrar"
            ) : authMode === "signup" ? (
              <>
                <UserRoundPlus size={16} /> Criar conta
              </>
            ) : authMode === "forgot-password" ? (
              "Enviar link"
            ) : (
              "Salvar senha"
            )}
          </button>
          <div className="auth-links">
            {authMode === "signin" ? (
              <>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setAuthMode("signup")}
                >
                  Criar conta
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
          </div>
        </form>
      </main>
    );
  }

  // ── Render: app ────────────────────────────────────────────────────────────

  const displayName = profile?.display_name || sessionEmail.split("@")[0];

  return (
    <>
      <main className="library-page">
        {/* Header */}
        <header className="app-header">
          <span className="app-name">tabTrad</span>
          <nav className="app-nav">
            <Link
              href="/biblioteca/faixas"
              className={`nav-pill${section === "tracks" ? " active" : ""}`}
            >
              <Music2 size={15} /> Faixas
            </Link>
            <Link
              href="/biblioteca/perfil"
              className={`nav-pill${section === "profile" ? " active" : ""}`}
            >
              <UserRound size={15} /> Perfil
            </Link>
          </nav>
          <div className="header-user">
            <span className="header-username">{displayName}</span>
            <button
              className="icon-button"
              onClick={handleLogout}
              type="button"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {statusMessage ? (
          <p className="status-banner success">{statusMessage}</p>
        ) : null}
        {errorMessage ? (
          <p className="status-banner error">{errorMessage}</p>
        ) : null}

        {/* ── Tracks ─────────────────────────────────────────────────────── */}
        {section === "tracks" ? (
          <section className="tracks-section">
            <div className="explorer-layout">
              {/* Sidebar */}
              <nav className="explorer-sidebar">
                <button
                  className={`sidebar-item${!selectedCollectionId ? " active" : ""}`}
                  onClick={() => setSelectedCollectionId("")}
                >
                  <Music2 size={15} />
                  <span>Todas as faixas</span>
                  <span className="sidebar-count">{tracks.length}</span>
                </button>

                <div className="sidebar-divider" />
                <span className="sidebar-label">Categorias</span>

                {collections.map((col) => (
                  <div
                    key={col.id}
                    className={`sidebar-item${selectedCollectionId === col.id ? " active" : ""}${dropCollectionId === col.id ? " drop-target" : ""}`}
                    onClick={() => setSelectedCollectionId(col.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropCollectionId(col.id);
                    }}
                    onDragLeave={() => setDropCollectionId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropCollectionId(null);
                      if (draggedTrackId)
                        handleAddToCollection(col.id, draggedTrackId);
                    }}
                  >
                    <FolderClosed size={15} />
                    <span className="sidebar-item-name">{col.name}</span>
                    <span className="sidebar-count">
                      {
                        collectionTracks.filter(
                          (ct) => ct.collection_id === col.id
                        ).length
                      }
                    </span>
                    <div
                      className="sidebar-item-menu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="icon-button small"
                        onClick={() =>
                          setOpenCollectionMenuId(
                            openCollectionMenuId === col.id ? null : col.id
                          )
                        }
                      >
                        <MoreHorizontal size={13} />
                      </button>
                      {openCollectionMenuId === col.id && (
                        <div className="context-menu">
                          <button
                            onClick={() => {
                              setShareCollectionId(col.id);
                              setIsShareCollectionOpen(true);
                              setOpenCollectionMenuId(null);
                            }}
                          >
                            <Share2 size={14} /> Compartilhar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCollectionId(col.id);
                              setCollectionName(col.name);
                              setCollectionDescription(col.description ?? "");
                              setCollectionVisibility(col.visibility);
                              setIsEditCollectionOpen(true);
                              setOpenCollectionMenuId(null);
                            }}
                          >
                            <FolderCog size={14} /> Editar
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              handleDeleteCollection(col.id);
                              setOpenCollectionMenuId(null);
                            }}
                          >
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  className="sidebar-add-btn"
                  onClick={() => setIsCreateCollectionOpen(true)}
                >
                  <FolderPlus size={15} />
                  Nova categoria
                </button>
              </nav>

              {/* Main panel */}
              <section className="explorer-main">
                {/* Toolbar */}
                <div className="explorer-toolbar">
                  <h2 className="explorer-title">
                    {selectedCollection
                      ? selectedCollection.name
                      : "Todas as faixas"}
                    <span className="explorer-count">
                      {visibleTracks.length} faixas
                    </span>
                  </h2>
                  <div className="explorer-actions">
                    {selectedCollection && (
                      <button
                        className="button secondary small"
                        onClick={() => {
                          setShareCollectionId(selectedCollection.id);
                          setIsShareCollectionOpen(true);
                        }}
                      >
                        <Share2 size={15} /> Compartilhar
                      </button>
                    )}
                    <button
                      className="button primary small"
                      onClick={() => setIsAddTrackOpen(true)}
                    >
                      <Upload size={15} /> Upload
                    </button>
                  </div>
                </div>

                {/* Track table */}
                {visibleTracks.length === 0 && !loadingLibrary ? (
                  <p className="empty-state">
                    {selectedCollection
                      ? "Nenhuma faixa nesta categoria. Arraste faixas para cá ou use o botão acima."
                      : "Nenhuma faixa ainda. Faça upload da primeira música."}
                  </p>
                ) : (
                  <div className="file-table">
                    <div className="file-table-header">
                      <span>#</span>
                      <span>Título</span>
                      <span>Artista</span>
                      <span>Duração</span>
                      <span></span>
                    </div>
                    {visibleTracks.map((track, idx) => (
                      <div
                        key={track.id}
                        className={`file-row${player.currentTrack?.id === track.id ? " playing" : ""}${busyTrackId === track.id ? " busy" : ""}`}
                        draggable
                        onDragStart={() => setDraggedTrackId(track.id)}
                        onDragEnd={() => setDraggedTrackId(null)}
                        onClick={() => handlePlay(track)}
                      >
                        <span className="track-idx">
                          {player.currentTrack?.id === track.id &&
                          player.isPlaying ? (
                            <Disc3 size={13} className="spin" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <div className="track-title-col">
                          <strong>{track.title}</strong>
                          {track.notes && (
                            <span className="track-notes">{track.notes}</span>
                          )}
                        </div>
                        <span className="track-artist">
                          {track.artist ?? "—"}
                        </span>
                        <span className="track-duration">
                          {formatDuration(track.duration_seconds)}
                        </span>
                        <div
                          className="track-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {selectedCollectionId && (
                            <>
                              <button
                                className="icon-button small"
                                aria-label="Mover para cima"
                                onClick={() =>
                                  handleMoveTrack(track.id, "up")
                                }
                                disabled={idx === 0}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                className="icon-button small"
                                aria-label="Mover para baixo"
                                onClick={() =>
                                  handleMoveTrack(track.id, "down")
                                }
                                disabled={idx === visibleTracks.length - 1}
                              >
                                <ArrowDown size={14} />
                              </button>
                            </>
                          )}
                          <div className="relative">
                            <button
                              className="icon-button small"
                              onClick={() =>
                                setOpenTrackMenuId(
                                  openTrackMenuId === track.id
                                    ? null
                                    : track.id
                                )
                              }
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            {openTrackMenuId === track.id && (
                              <div className="context-menu">
                                {!selectedCollectionId &&
                                  collections.length > 0 && (
                                    <div className="context-submenu-label">
                                      Adicionar a categoria
                                    </div>
                                  )}
                                {!selectedCollectionId &&
                                  collections.map((col) => (
                                    <button
                                      key={col.id}
                                      onClick={() => {
                                        handleAddToCollection(
                                          col.id,
                                          track.id
                                        );
                                        setOpenTrackMenuId(null);
                                      }}
                                    >
                                      <FolderPlus size={14} /> {col.name}
                                    </button>
                                  ))}
                                {selectedCollectionId && (
                                  <button
                                    onClick={() => {
                                      handleRemoveFromCollection(
                                        selectedCollectionId,
                                        track.id
                                      );
                                      setOpenTrackMenuId(null);
                                    }}
                                  >
                                    <FolderCog size={14} /> Remover da
                                    categoria
                                  </button>
                                )}
                                <button
                                  className="danger"
                                  onClick={() => {
                                    handleDeleteTrack(
                                      track.id,
                                      track.storage_path,
                                      track.storage_bucket
                                    );
                                    setOpenTrackMenuId(null);
                                  }}
                                >
                                  <Trash2 size={14} /> Excluir faixa
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        ) : null}

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        {section === "profile" ? (
          <section className="profile-section">
            <form className="profile-form" onSubmit={handleProfileSave}>
              <h1 className="tracks-title">Perfil</h1>
              <label className="field">
                <span>Nome de exibição</span>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Seu nome"
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={sessionEmail} readOnly />
              </label>
              <button
                className="button primary"
                type="submit"
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <LoaderCircle className="spin" size={16} /> Salvando
                  </>
                ) : (
                  "Salvar"
                )}
              </button>
            </form>
            <aside className="profile-summary-card">
              <h2 className="profile-summary-title">Resumo</h2>
              <div className="profile-summary">
                <div className="profile-stat">
                  <span>Nome</span>
                  <strong>{profile?.display_name || "Não definido"}</strong>
                </div>
                <div className="profile-stat">
                  <span>Papel</span>
                  <strong>{profile?.role || "member"}</strong>
                </div>
                <div className="profile-stat">
                  <span>Membro desde</span>
                  <strong>{formatDate(profile?.created_at ?? null)}</strong>
                </div>
                <div className="profile-stat">
                  <span>Faixas</span>
                  <strong>{tracks.length}</strong>
                </div>
                <div className="profile-stat">
                  <span>Categorias</span>
                  <strong>{collections.length}</strong>
                </div>
              </div>
            </aside>
          </section>
        ) : null}
      </main>

      {/* ── Upload Modal ────────────────────────────────────────────────────── */}
      {isAddTrackOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsAddTrackOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload de faixa</h2>
              <button
                className="icon-button"
                onClick={() => setIsAddTrackOpen(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <form className="upload-form" onSubmit={handleUpload}>
              <label className="field upload-form-file">
                <span>Arquivo de áudio</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  required
                />
              </label>
              <label className="field">
                <span>Título</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome da faixa"
                  required
                />
              </label>
              <label className="field">
                <span>Artista</span>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label className="field upload-form-notes">
                <span>Notas</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Coreografia, turma, observações…"
                  rows={2}
                />
              </label>
              <div className="upload-form-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Enviando
                    </>
                  ) : (
                    <>
                      <Upload size={16} /> Enviar faixa
                    </>
                  )}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsAddTrackOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Collection Modal ──────────────────────────────────────────── */}
      {isCreateCollectionOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsCreateCollectionOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova categoria</h2>
              <button
                className="icon-button"
                onClick={() => setIsCreateCollectionOpen(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={handleCreateCollection}
            >
              <label className="field">
                <span>Nome</span>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="Ex: Forró pé de serra"
                  required
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <textarea
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  placeholder="Opcional"
                  rows={2}
                />
              </label>
              <label className="field">
                <span>Visibilidade</span>
                <select
                  value={collectionVisibility}
                  onChange={(e) =>
                    setCollectionVisibility(
                      e.target.value as "private" | "team" | "public"
                    )
                  }
                >
                  <option value="private">Privada</option>
                  <option value="team">Time</option>
                  <option value="public">Pública</option>
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={creatingCollection}
                >
                  {creatingCollection ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Criando
                    </>
                  ) : (
                    "Criar"
                  )}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsCreateCollectionOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Collection Modal ────────────────────────────────────────────── */}
      {isEditCollectionOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsEditCollectionOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar categoria</h2>
              <button
                className="icon-button"
                onClick={() => setIsEditCollectionOpen(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleEditCollection}>
              <label className="field">
                <span>Nome</span>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <textarea
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  rows={2}
                />
              </label>
              <label className="field">
                <span>Visibilidade</span>
                <select
                  value={collectionVisibility}
                  onChange={(e) =>
                    setCollectionVisibility(
                      e.target.value as "private" | "team" | "public"
                    )
                  }
                >
                  <option value="private">Privada</option>
                  <option value="team">Time</option>
                  <option value="public">Pública</option>
                </select>
              </label>
              {selectedCollection?.visibility === "public" &&
                selectedCollection?.public_share_token && (
                  <div className="field">
                    <span>Link público</span>
                    <div className="share-url-row">
                      <input
                        type="text"
                        readOnly
                        value={getShareUrl(
                          selectedCollection.public_share_token
                        )}
                      />
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            getShareUrl(
                              selectedCollection!.public_share_token
                            )
                          )
                        }
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                )}
              <div className="modal-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={savingCollection}
                >
                  {savingCollection ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Salvando
                    </>
                  ) : (
                    "Salvar"
                  )}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsEditCollectionOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Share / Invite Modal ─────────────────────────────────────────────── */}
      {isShareCollectionOpen && shareCollectionId && (
        <div
          className="modal-overlay"
          onClick={() => setIsShareCollectionOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Compartilhar categoria</h2>
              <button
                className="icon-button"
                onClick={() => setIsShareCollectionOpen(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            {(() => {
              const col = collections.find((c) => c.id === shareCollectionId);
              return col?.visibility === "public" && col.public_share_token ? (
                <div className="modal-form">
                  <div className="field">
                    <span>Link público</span>
                    <div className="share-url-row">
                      <input
                        type="text"
                        readOnly
                        value={getShareUrl(col.public_share_token)}
                      />
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            getShareUrl(col.public_share_token)
                          )
                        }
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
            <form className="modal-form" onSubmit={handleInvite}>
              <label className="field">
                <span>Convidar por email</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colega@exemplo.com"
                  required
                />
              </label>
              <label className="field">
                <span>Permissão</span>
                <select
                  value={invitePermission}
                  onChange={(e) =>
                    setInvitePermission(
                      e.target.value as "viewer" | "editor"
                    )
                  }
                >
                  <option value="viewer">Visualizador</option>
                  <option value="editor">Editor</option>
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={inviting}
                >
                  {inviting ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Enviando
                    </>
                  ) : (
                    "Convidar"
                  )}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsShareCollectionOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
