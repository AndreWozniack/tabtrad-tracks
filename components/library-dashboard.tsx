"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Disc3,
  FolderCog,
  FolderPlus,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Music2,
  Play,
  StepBack,
  StepForward,
  Trash2,
  Upload,
  UserRound,
  UserRoundPlus,
  Users
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
  email: string | null;
  display_name: string | null;
  role: string;
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionTracks, setCollectionTracks] = useState<CollectionTrackRow[]>([]);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionVisibility, setCollectionVisibility] =
    useState<CollectionRow["visibility"]>("private");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [shareCollectionId, setShareCollectionId] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"viewer" | "editor">(
    "viewer"
  );
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [sharingCollection, setSharingCollection] = useState(false);
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isShareCollectionOpen, setIsShareCollectionOpen] = useState(false);
  const [isEditCollectionOpen, setIsEditCollectionOpen] = useState(false);
  const [openTrackMenuId, setOpenTrackMenuId] = useState<string | null>(null);
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<string | null>(null);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropCollectionId, setDropCollectionId] = useState<string | null>(null);
  const isRecoveryMode = authMode === "reset-password";

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === playingTrackId) ?? null,
    [playingTrackId, tracks]
  );

  const selectedCollection = useMemo(
    () =>
      collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  );

  const visibleTracks = useMemo(() => {
    if (!selectedCollectionId) {
      return tracks;
    }

    const orderedItems = collectionTracks
      .filter((item) => item.collection_id === selectedCollectionId)
      .sort((a, b) => a.sort_order - b.sort_order);

    return orderedItems
      .map((item) => tracks.find((track) => track.id === item.track_id) ?? null)
      .filter((track): track is TrackRow => Boolean(track));
  }, [collectionTracks, selectedCollectionId, tracks]);

  const playerTracks = useMemo(() => {
    if (!selectedCollectionId) {
      return tracks;
    }

    const orderedItems = collectionTracks
      .filter((item) => item.collection_id === selectedCollectionId)
      .sort((a, b) => a.sort_order - b.sort_order);

    return orderedItems
      .map((item) => tracks.find((track) => track.id === item.track_id) ?? null)
      .filter((track): track is TrackRow => Boolean(track));
  }, [collectionTracks, selectedCollectionId, tracks]);

  function collectionTrackCount(collectionId: string) {
    return collectionTracks.filter((item) => item.collection_id === collectionId).length;
  }

  function trackCollectionNames(trackId: string) {
    const ids = collectionTracks
      .filter((item) => item.track_id === trackId)
      .map((item) => item.collection_id);

    return collections
      .filter((collection) => ids.includes(collection.id))
      .map((collection) => collection.name);
  }

  const currentQueue = useMemo(() => {
    return playerTracks;
  }, [playerTracks]);

  const currentQueueIndex = useMemo(() => {
    return currentQueue.findIndex((track) => track.id === playingTrackId);
  }, [currentQueue, playingTrackId]);

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
    async function detectRecoverySession() {
      if (typeof window === "undefined") return;

      const url = new URL(window.location.href);

      if (url.searchParams.get("mode") === "reset-password") {
        setAuthMode("reset-password");
        setStatusMessage("Defina sua nova senha para concluir a recuperação.");
        return;
      }

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

  useEffect(() => {
    if (!userId) {
      setTracks([]);
      setProfile(null);
      setCollections([]);
      setCollectionTracks([]);
      return;
    }

    let isMounted = true;

    async function fetchLibrary() {
      setLoadingLibrary(true);
      setErrorMessage(null);

      const [
        { data: tracksData, error: tracksError },
        { data: profileData, error: profileError },
        { data: collectionsData, error: collectionsError },
        { data: collectionTracksData, error: collectionTracksError }
      ] = await Promise.all([
        supabase
          .from("tracks")
          .select(
            "id, title, artist, notes, storage_bucket, storage_path, duration_seconds, file_size_bytes, created_at"
          )
          .eq("owner_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, email, display_name, role, created_at")
          .eq("id", userId)
          .single(),
        supabase
          .from("collections")
          .select("id, name, description, visibility, public_share_token, created_at")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("collection_tracks")
          .select("id, collection_id, track_id, sort_order")
          .order("sort_order", { ascending: true })
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

      if (collectionsError) {
        setErrorMessage(collectionsError.message);
      } else {
        const nextCollections = (collectionsData ?? []) as CollectionRow[];
        setCollections(nextCollections);
        setSelectedCollectionId((current) => current || nextCollections[0]?.id || "");
        setShareCollectionId((current) => current || nextCollections[0]?.id || "");
      }

      if (collectionTracksError) {
        setErrorMessage(collectionTracksError.message);
      } else {
        setCollectionTracks((collectionTracksData ?? []) as CollectionTrackRow[]);
      }

      setLoadingLibrary(false);
    }

    fetchLibrary();

    return () => {
      isMounted = false;
    };
  }, [supabase, userId]);

  async function refreshLibrary() {
    if (!userId) return;

    const [
      { data: tracksData, error: tracksError },
      { data: collectionsData, error: collectionsError },
      { data: collectionTracksData, error: collectionTracksError }
    ] = await Promise.all([
      supabase
        .from("tracks")
        .select(
          "id, title, artist, notes, storage_bucket, storage_path, duration_seconds, file_size_bytes, created_at"
        )
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("collections")
        .select("id, name, description, visibility, public_share_token, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("collection_tracks")
        .select("id, collection_id, track_id, sort_order")
        .order("sort_order", { ascending: true })
    ]);

    if (tracksError || collectionsError || collectionTracksError) {
      setErrorMessage(
        tracksError?.message ||
          collectionsError?.message ||
          collectionTracksError?.message ||
          "Falha ao atualizar biblioteca."
      );
      return;
    }

    const nextCollections = (collectionsData ?? []) as CollectionRow[];
    setTracks((tracksData ?? []) as TrackRow[]);
    setCollections(nextCollections);
    setCollectionTracks((collectionTracksData ?? []) as CollectionTrackRow[]);
    setSelectedCollectionId((current) =>
      current && nextCollections.some((collection) => collection.id === current)
        ? current
        : ""
    );
    setShareCollectionId((current) => current || nextCollections[0]?.id || "");
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
          : `${window.location.origin}/auth/callback?next=/biblioteca/perfil&mode=reset-password`;

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

      const { error } = await supabase.auth.updateUser({ password });

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });

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
      setIsAddTrackOpen(false);
      await refreshLibrary();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao enviar o arquivo."
      );
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploading(false);
    }
  }

  function handleCloseAddTrackModal() {
    setIsAddTrackOpen(false);
    setSelectedFile(null);
    setTitle("");
    setArtist("");
    setNotes("");
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

  async function handleDeleteTrack(track: TrackRow) {
    setBusyTrackId(track.id);
    setErrorMessage(null);
    setStatusMessage(null);

    const bucket = track.storage_bucket ?? storageBucket;

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([track.storage_path]);

    if (storageError) {
      setErrorMessage(storageError.message);
      setBusyTrackId(null);
      return;
    }

    const { error: deleteCollectionError } = await supabase
      .from("collection_tracks")
      .delete()
      .eq("track_id", track.id);

    if (deleteCollectionError) {
      setErrorMessage(deleteCollectionError.message);
      setBusyTrackId(null);
      return;
    }

    const { error: deleteTrackError } = await supabase
      .from("tracks")
      .delete()
      .eq("id", track.id);

    if (deleteTrackError) {
      setErrorMessage(deleteTrackError.message);
      setBusyTrackId(null);
      return;
    }

    if (playingTrackId === track.id) {
      setPlayingTrackId(null);
      setAudioUrl(null);
    }

    setStatusMessage("Faixa removida.");
    setBusyTrackId(null);
    await refreshLibrary();
  }

  async function handleCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !collectionName.trim()) {
      setErrorMessage("Informe um nome para a pasta ou playlist.");
      return;
    }

    setSavingCollection(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const slugBase = slugify(collectionName);

    const { error } = await supabase.from("collections").insert({
      owner_id: userId,
      name: collectionName.trim(),
      description: collectionDescription.trim() || null,
      slug: `${slugBase || "colecao"}-${crypto.randomUUID().slice(0, 8)}`,
      visibility: collectionVisibility
    });

    if (error) {
      setErrorMessage(error.message);
      setSavingCollection(false);
      return;
    }

    setCollectionName("");
    setCollectionDescription("");
    setCollectionVisibility("private");
    setIsCreateCollectionOpen(false);
    setStatusMessage("Pasta ou playlist criada.");
    setSavingCollection(false);
    await refreshLibrary();
  }

  async function handleUpdateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCollection) {
      setErrorMessage("Selecione uma pasta antes de editar.");
      return;
    }

    setSavingCollection(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase
      .from("collections")
      .update({
        name: collectionName.trim(),
        description: collectionDescription.trim() || null,
        visibility: collectionVisibility
      })
      .eq("id", selectedCollection.id);

    if (error) {
      setErrorMessage(error.message);
      setSavingCollection(false);
      return;
    }

    setStatusMessage("Pasta atualizada.");
    setSavingCollection(false);
    setIsEditCollectionOpen(false);
    await refreshLibrary();
  }

  async function handleDeleteCollection() {
    if (!selectedCollection) {
      setErrorMessage("Selecione uma pasta antes de excluir.");
      return;
    }

    setSavingCollection(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error: deleteTracksLinkError } = await supabase
      .from("collection_tracks")
      .delete()
      .eq("collection_id", selectedCollection.id);

    if (deleteTracksLinkError) {
      setErrorMessage(deleteTracksLinkError.message);
      setSavingCollection(false);
      return;
    }

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", selectedCollection.id);

    if (error) {
      setErrorMessage(error.message);
      setSavingCollection(false);
      return;
    }

    setSelectedCollectionId("");
    setShareCollectionId("");
    setCollectionName("");
    setCollectionDescription("");
    setCollectionVisibility("private");
    setStatusMessage("Pasta excluída.");
    setSavingCollection(false);
    setIsEditCollectionOpen(false);
    await refreshLibrary();
  }

  async function handleAddTrackToCollection(trackId: string) {
    if (!selectedCollectionId) {
      setErrorMessage("Selecione uma pasta ou playlist para adicionar a música.");
      return;
    }

    await handleAddTrackToSpecificCollection(trackId, selectedCollectionId);
  }

  async function handleAddTrackToSpecificCollection(
    trackId: string,
    collectionId: string
  ) {
    const targetCollection = collections.find((collection) => collection.id === collectionId);

    const exists = collectionTracks.some(
      (item) => item.collection_id === collectionId && item.track_id === trackId
    );

    if (exists) {
      setStatusMessage("Essa música já está nessa pasta.");
      return;
    }

    setBusyTrackId(trackId);
    setErrorMessage(null);
    setStatusMessage(null);

    const nextSort =
      collectionTracks
        .filter((item) => item.collection_id === collectionId)
        .reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;

    const { error } = await supabase.from("collection_tracks").insert({
      collection_id: collectionId,
      track_id: trackId,
      sort_order: nextSort
    });

    if (error) {
      setErrorMessage(error.message);
      setBusyTrackId(null);
      return;
    }

    setStatusMessage(`Música adicionada em ${targetCollection?.name || "sua pasta"}.`);
    setBusyTrackId(null);
    await refreshLibrary();
  }

  async function handleMoveTrackInCollection(trackId: string, direction: "up" | "down") {
    if (!selectedCollectionId) return;

    const orderedItems = collectionTracks
      .filter((item) => item.collection_id === selectedCollectionId)
      .sort((a, b) => a.sort_order - b.sort_order);

    const currentIndex = orderedItems.findIndex((item) => item.track_id === trackId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return;

    const currentItem = orderedItems[currentIndex];
    const targetItem = orderedItems[targetIndex];

    setBusyTrackId(trackId);
    setErrorMessage(null);

    const { error: firstError } = await supabase
      .from("collection_tracks")
      .update({ sort_order: -1 })
      .eq("id", currentItem.id);

    if (firstError) {
      setErrorMessage(firstError.message);
      setBusyTrackId(null);
      return;
    }

    const { error: secondError } = await supabase
      .from("collection_tracks")
      .update({ sort_order: currentItem.sort_order })
      .eq("id", targetItem.id);

    if (secondError) {
      setErrorMessage(secondError.message);
      setBusyTrackId(null);
      return;
    }

    const { error: thirdError } = await supabase
      .from("collection_tracks")
      .update({ sort_order: targetItem.sort_order })
      .eq("id", currentItem.id);

    if (thirdError) {
      setErrorMessage(thirdError.message);
      setBusyTrackId(null);
      return;
    }

    setBusyTrackId(null);
    await refreshLibrary();
  }

  async function handleRemoveTrackFromSelectedCollection(trackId: string) {
    if (!selectedCollectionId) {
      setErrorMessage("Selecione uma pasta antes de remover a faixa dela.");
      return;
    }

    setBusyTrackId(trackId);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase
      .from("collection_tracks")
      .delete()
      .eq("collection_id", selectedCollectionId)
      .eq("track_id", trackId);

    if (error) {
      setErrorMessage(error.message);
      setBusyTrackId(null);
      return;
    }

    setStatusMessage("Faixa removida da pasta atual.");
    setBusyTrackId(null);
    await refreshLibrary();
  }

  async function handleShareCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!shareCollectionId || !inviteEmail.trim()) {
      setErrorMessage("Escolha uma coleção e informe o email do usuário.");
      return;
    }

    setSharingCollection(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase.rpc("invite_user_to_collection", {
      target_collection_id: shareCollectionId,
      target_email: inviteEmail.trim(),
      target_permission: invitePermission
    });

    if (error) {
      setErrorMessage(error.message);
      setSharingCollection(false);
      return;
    }

    setInviteEmail("");
    setIsShareCollectionOpen(false);
    setStatusMessage("Compartilhamento registrado para essa pasta.");
    setSharingCollection(false);
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

  function openEditCollectionModal() {
    if (!selectedCollection) return;
    setCollectionName(selectedCollection.name);
    setCollectionDescription(selectedCollection.description || "");
    setCollectionVisibility(selectedCollection.visibility);
    setIsEditCollectionOpen(true);
  }

  async function handlePlayPrevious() {
    if (currentQueueIndex <= 0) return;
    await handlePlay(currentQueue[currentQueueIndex - 1]);
  }

  async function handlePlayNext() {
    if (currentQueueIndex < 0 || currentQueueIndex >= currentQueue.length - 1) return;
    await handlePlay(currentQueue[currentQueueIndex + 1]);
  }

  function handleTrackDragStart(trackId: string) {
    setDraggedTrackId(trackId);
  }

  function handleTrackDragEnd() {
    setDraggedTrackId(null);
    setDropCollectionId(null);
  }

  if (loadingSession) {
    return (
      <main className="library-page wide">
        <section className="center-card">
          <LoaderCircle className="spin" size={20} />
          <span>Carregando sessão...</span>
        </section>
      </main>
    );
  }

  if (!sessionEmail || isRecoveryMode) {
    return (
      <main className="library-page wide">
        <section className="library-toolbar solo">
          <div>
            <span className="eyebrow">Acesso</span>
            <h1>Entre para gerenciar sua biblioteca</h1>
            <p>Fluxo direto para login, recuperação de senha e organização do repertório.</p>
          </div>
        </section>

        {statusMessage ? <p className="status-banner success">{statusMessage}</p> : null}
        {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

        <section className="single-column-section">
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
                <button className="button secondary" type="button" onClick={() => setAuthMode("signup")}>
                  Ainda não tenho conta
                </button>
                <button className="text-button" type="button" onClick={() => setAuthMode("forgot-password")}>
                  Esqueci minha senha
                </button>
              </>
            ) : null}

            {authMode === "signup" ? (
              <button className="button secondary" type="button" onClick={() => setAuthMode("signin")}>
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
        </section>
      </main>
    );
  }

  return (
    <main className="library-page wide">
      <section className="library-toolbar compact">
        <div>
          <span className="eyebrow">Biblioteca</span>
          <h1>
            {section === "tracks"
              ? "Faixas e pastas"
              : section === "player"
                ? "Player de ensaio"
                : "Perfil da conta"}
          </h1>
          <p>
            Biblioteca em coluna única, com foco em organizar, tocar e compartilhar repertórios.
          </p>
        </div>
      </section>

      <nav className="section-nav">
        <Link href="/biblioteca/faixas" className={`nav-pill ${section === "tracks" ? "active" : ""}`}>
          <Music2 size={16} />
          Faixas
        </Link>
        <Link href="/biblioteca/player" className={`nav-pill ${section === "player" ? "active" : ""}`}>
          <Disc3 size={16} />
          Player
        </Link>
        <Link href="/biblioteca/perfil" className={`nav-pill ${section === "profile" ? "active" : ""}`}>
          <UserRound size={16} />
          Perfil
        </Link>
      </nav>

      {statusMessage ? <p className="status-banner success">{statusMessage}</p> : null}
      {errorMessage ? <p className="status-banner error">{errorMessage}</p> : null}

      {section === "tracks" ? (
        <div className="single-column-stack">
          <section className="explorer-layout">
            <aside className="panel-card explorer-sidebar">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Pastas</span>
                  <h2>Explorer</h2>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsCreateCollectionOpen(true)}
                >
                  <FolderPlus size={16} />
                  Nova pasta
                </button>
              </div>

              <div className="explorer-tree">
                <button
                  type="button"
                  className={`folder-row ${selectedCollectionId === "" ? "active" : ""}`}
                  onClick={() => setSelectedCollectionId("")}
                >
                  <span>Todas as faixas</span>
                  <small>{tracks.length}</small>
                </button>
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className={`folder-row ${selectedCollectionId === collection.id ? "active" : ""} ${
                      dropCollectionId === collection.id ? "drop-target" : ""
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropCollectionId(collection.id);
                    }}
                    onDragLeave={() =>
                      setDropCollectionId((current) =>
                        current === collection.id ? null : current
                      )
                    }
                    onDrop={async (event) => {
                      event.preventDefault();
                      if (draggedTrackId) {
                        await handleAddTrackToSpecificCollection(draggedTrackId, collection.id);
                      }
                      handleTrackDragEnd();
                    }}
                  >
                    <button
                      type="button"
                      className="folder-main-button"
                      onClick={() => {
                        setSelectedCollectionId(collection.id);
                        setShareCollectionId(collection.id);
                        setOpenCollectionMenuId(null);
                      }}
                    >
                      <div>
                        <strong>{collection.name}</strong>
                        <small>{collection.description || collection.visibility}</small>
                      </div>
                      <small>{collectionTrackCount(collection.id)}</small>
                    </button>
                    <div className="context-menu-wrap">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          setOpenCollectionMenuId((current) =>
                            current === collection.id ? null : collection.id
                          )
                        }
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openCollectionMenuId === collection.id ? (
                        <div className="context-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollectionId(collection.id);
                              setShareCollectionId(collection.id);
                              openEditCollectionModal();
                              setOpenCollectionMenuId(null);
                            }}
                          >
                            Editar pasta
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollectionId(collection.id);
                              setShareCollectionId(collection.id);
                              setIsShareCollectionOpen(true);
                              setOpenCollectionMenuId(null);
                            }}
                          >
                            Compartilhar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div className="explorer-main">
              <section className="panel-card">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Conteúdo</span>
                  <h2>{selectedCollection ? selectedCollection.name : "Todas as faixas"}</h2>
                    <p className="panel-subtle">
                      {selectedCollection
                        ? selectedCollection.description || "Pasta selecionada na lateral."
                        : "Selecione uma pasta na lateral para trabalhar como no Finder."}
                    </p>
                  </div>
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => setIsAddTrackOpen(true)}
                  >
                    <Upload size={16} />
                    Adicionar Faixa
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setIsShareCollectionOpen(true)}
                    disabled={!selectedCollection}
                  >
                    <Users size={16} />
                    Compartilhar Pasta
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={openEditCollectionModal}
                    disabled={!selectedCollection}
                  >
                    <FolderCog size={16} />
                    Editar Pasta
                  </button>
                </div>

                <div className="explorer-toolbar">
                  <span className="panel-subtle">
                    {selectedCollection
                      ? `Adicionando faixas em: ${selectedCollection.name}`
                      : "Selecione uma pasta na lateral para adicionar faixas a ela."}
                  </span>
                </div>

                <div className="file-table">
                  <div className="file-table-header">
                    <span>Nome</span>
                    <span>Artista</span>
                    <span>Duração</span>
                    <span>Pastas</span>
                    <span>Ações</span>
                  </div>
                </div>

                <div className="track-manager-list file-table-body">
                  {visibleTracks.map((track) => (
                    <article key={track.id} className="track-manager-item file-row">
                      <div
                        className="file-row-drag"
                        draggable
                        onDragStart={() => handleTrackDragStart(track.id)}
                        onDragEnd={handleTrackDragEnd}
                      >
                        <div className="track-main">
                          <strong>{track.title}</strong>
                          <small>{formatBytes(track.file_size_bytes)}</small>
                        </div>
                        <span>{track.artist || "Artista não informado"}</span>
                        <span>{formatDuration(track.duration_seconds)}</span>
                        <span>{trackCollectionNames(track.id).join(", ") || "nenhuma"}</span>
                        <div className="track-actions">
                          {selectedCollection ? (
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() => handleMoveTrackInCollection(track.id, "up")}
                              disabled={busyTrackId === track.id}
                            >
                              <ArrowUp size={16} />
                            </button>
                          ) : null}
                          {selectedCollection ? (
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() => handleMoveTrackInCollection(track.id, "down")}
                              disabled={busyTrackId === track.id}
                            >
                              <ArrowDown size={16} />
                            </button>
                          ) : null}
                          <div className="context-menu-wrap">
                            <button
                              className="icon-button"
                              type="button"
                              onClick={() =>
                                setOpenTrackMenuId((current) =>
                                  current === track.id ? null : track.id
                                )
                              }
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {openTrackMenuId === track.id ? (
                              <div className="context-menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handlePlay(track);
                                    setOpenTrackMenuId(null);
                                  }}
                                >
                                  Tocar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleAddTrackToCollection(track.id);
                                    setOpenTrackMenuId(null);
                                  }}
                                  disabled={!selectedCollectionId || busyTrackId === track.id}
                                >
                                  {selectedCollection ? "Adicionar nesta pasta" : "Escolha uma pasta"}
                                </button>
                                {selectedCollection ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleRemoveTrackFromSelectedCollection(track.id);
                                      setOpenTrackMenuId(null);
                                    }}
                                  >
                                    Remover da pasta
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDeleteTrack(track);
                                    setOpenTrackMenuId(null);
                                  }}
                                >
                                  Excluir faixa
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                  {visibleTracks.length === 0 ? (
                    <p className="empty-state">
                      {selectedCollection
                        ? "Nenhuma faixa nesta pasta ainda."
                        : "Nenhuma faixa cadastrada ainda."}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {section === "player" ? (
        <div className="single-column-stack">
          <section className="panel-card player-stage">
            <div className="player-folder-strip">
              <button
                type="button"
                className={`folder-chip ${selectedCollectionId === "" ? "active" : ""}`}
                onClick={() => setSelectedCollectionId("")}
              >
                Todas as faixas
              </button>
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  className={`folder-chip ${selectedCollectionId === collection.id ? "active" : ""}`}
                  onClick={() => setSelectedCollectionId(collection.id)}
                >
                  {collection.name}
                </button>
              ))}
            </div>

            <div className="player-now">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Player</span>
                  <h2>Rodar repertório</h2>
                  <p className="panel-subtle">
                    {selectedCollection
                      ? `Fila atual da pasta ${selectedCollection.name}.`
                      : "Clique em uma faixa na lateral para tocar."}
                  </p>
                </div>
                <div className="player-controls">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={handlePlayPrevious}
                    disabled={currentQueueIndex <= 0}
                  >
                    <StepBack size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={handlePlayNext}
                    disabled={
                      currentQueueIndex < 0 || currentQueueIndex >= currentQueue.length - 1
                    }
                  >
                    <StepForward size={16} />
                  </button>
                </div>
              </div>
              {currentTrack ? (
                <div className="current-track">
                  <strong>{currentTrack.title}</strong>
                  <span>{currentTrack.artist || "Artista não informado"}</span>
                  <span>{formatDuration(currentTrack.duration_seconds)}</span>
                </div>
              ) : (
                <div className="player-placeholder">
                  <Disc3 size={18} />
                  <span>Escolha uma faixa da fila abaixo para começar.</span>
                </div>
              )}
              {audioUrl ? (
                <audio
                  key={audioUrl}
                  controls
                  preload="metadata"
                  src={audioUrl}
                  onEnded={() => {
                    void handlePlayNext();
                  }}
                />
              ) : null}
            </div>

            <div className="player-queue">
              <div className="player-queue-header">
                <div>
                  <span className="eyebrow">Fila Atual</span>
                  <h3>{selectedCollection ? selectedCollection.name : "Todas as faixas"}</h3>
                </div>
                <span className="panel-subtle">
                  {playerTracks.length} faixa{playerTracks.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="player-queue-list">
                {playerTracks.map((track, index) => (
                  <button
                    key={track.id}
                    type="button"
                    className={`queue-row ${playingTrackId === track.id ? "active" : ""}`}
                    onClick={() => handlePlay(track)}
                  >
                    <span className="queue-index">{index + 1}</span>
                    <div className="track-main">
                      <strong>{track.title}</strong>
                      <span>{track.artist || "Artista não informado"}</span>
                    </div>
                    <span>{formatDuration(track.duration_seconds)}</span>
                  </button>
                ))}
                {playerTracks.length === 0 ? (
                  <p className="empty-state">
                    {selectedCollection
                      ? "Nenhuma faixa nesta pasta."
                      : "Nenhuma faixa disponível."}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {section === "profile" ? (
        <div className="single-column-stack">
          <section className="panel-card">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Perfil</span>
                <h2>Dados da conta</h2>
              </div>
            </div>

            <form className="inline-form" onSubmit={handleProfileSave}>
              <label className="field grow">
                <span>Nome de exibição</span>
                <input
                  type="text"
                  value={displayNameInput}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  placeholder="Seu nome"
                />
              </label>
              <label className="field grow">
                <span>Email</span>
                <input type="email" value={profile?.email || sessionEmail || ""} readOnly />
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
              <div>
                <span>Total de pastas</span>
                <strong>{collections.length}</strong>
              </div>
            </div>

            <div className="profile-footer-actions">
              <button className="button secondary" onClick={handleLogout} type="button">
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isAddTrackOpen ? (
        <div className="modal-backdrop" onClick={handleCloseAddTrackModal} role="presentation">
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar faixa"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">Nova faixa</span>
                <h2>Adicionar Faixa</h2>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={handleCloseAddTrackModal}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpload}>
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
                  placeholder="Versão, coreografia, observações..."
                  rows={4}
                />
              </label>
              <div className="modal-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleCloseAddTrackModal}
                >
                  Cancelar
                </button>
                <button className="button primary" type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <LoaderCircle className="spin" size={16} />
                      Enviando
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Salvar faixa
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateCollectionOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsCreateCollectionOpen(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Criar pasta"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">Nova pasta</span>
                <h2>Criar pasta ou playlist</h2>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => setIsCreateCollectionOpen(false)}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCreateCollection}>
              <label className="field">
                <span>Nome</span>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  placeholder="Ex.: Festival 2026"
                  required
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <input
                  type="text"
                  value={collectionDescription}
                  onChange={(event) => setCollectionDescription(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label className="field">
                <span>Visibilidade</span>
                <select
                  value={collectionVisibility}
                  onChange={(event) =>
                    setCollectionVisibility(event.target.value as CollectionRow["visibility"])
                  }
                >
                  <option value="private">Privada</option>
                  <option value="team">Equipe</option>
                  <option value="public">Pública</option>
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsCreateCollectionOpen(false)}
                >
                  Cancelar
                </button>
                <button className="button primary" type="submit" disabled={savingCollection}>
                  {savingCollection ? (
                    <>
                      <LoaderCircle className="spin" size={16} />
                      Salvando
                    </>
                  ) : (
                    <>
                      <FolderPlus size={16} />
                      Criar pasta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isShareCollectionOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsShareCollectionOpen(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compartilhar pasta"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">Compartilhamento</span>
                <h2>Compartilhar pasta</h2>
                <p className="panel-subtle">
                  {selectedCollection
                    ? `Pasta selecionada: ${selectedCollection.name}`
                    : "Selecione uma pasta antes de compartilhar."}
                </p>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => setIsShareCollectionOpen(false)}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={handleShareCollection}>
              <label className="field">
                <span>Email do usuário</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="alguem@exemplo.com"
                  disabled={!selectedCollection}
                />
              </label>
              <label className="field">
                <span>Papel</span>
                <select
                  value={invitePermission}
                  onChange={(event) =>
                    setInvitePermission(event.target.value as "viewer" | "editor")
                  }
                  disabled={!selectedCollection}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setIsShareCollectionOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="button primary"
                  type="submit"
                  disabled={!selectedCollection || sharingCollection}
                >
                  {sharingCollection ? (
                    <>
                      <LoaderCircle className="spin" size={16} />
                      Compartilhando
                    </>
                  ) : (
                    <>
                      <Users size={16} />
                      Compartilhar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEditCollectionOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsEditCollectionOpen(false)}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Editar pasta"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">Editar pasta</span>
                <h2>{selectedCollection?.name || "Pasta selecionada"}</h2>
              </div>
              <button
                className="button secondary"
                type="button"
                onClick={() => setIsEditCollectionOpen(false)}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateCollection}>
              <label className="field">
                <span>Nome</span>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <input
                  type="text"
                  value={collectionDescription}
                  onChange={(event) => setCollectionDescription(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Visibilidade</span>
                <select
                  value={collectionVisibility}
                  onChange={(event) =>
                    setCollectionVisibility(event.target.value as CollectionRow["visibility"])
                  }
                >
                  <option value="private">Privada</option>
                  <option value="team">Equipe</option>
                  <option value="public">Pública</option>
                </select>
              </label>
              <div className="modal-actions between">
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleDeleteCollection}
                  disabled={savingCollection}
                >
                  <Trash2 size={16} />
                  Excluir pasta
                </button>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setIsEditCollectionOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button className="button primary" type="submit" disabled={savingCollection}>
                    {savingCollection ? (
                      <>
                        <LoaderCircle className="spin" size={16} />
                        Salvando
                      </>
                    ) : (
                      "Salvar alterações"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
