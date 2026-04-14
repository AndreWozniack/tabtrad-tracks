import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get("trackId");
  const token = searchParams.get("token");

  if (!trackId || !token) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 503 });
  }

  // Validate token and get collection
  const { data: collection } = await supabase
    .from("collections")
    .select("id, visibility")
    .eq("public_share_token", token)
    .eq("visibility", "public")
    .single();

  if (!collection) {
    return NextResponse.json({ error: "Token inválido" }, { status: 403 });
  }

  // Validate track belongs to this collection
  const { data: link } = await supabase
    .from("collection_tracks")
    .select("track_id")
    .eq("collection_id", collection.id)
    .eq("track_id", trackId)
    .single();

  if (!link) {
    return NextResponse.json({ error: "Faixa não encontrada nesta coleção" }, { status: 404 });
  }

  // Get track storage info
  const { data: track } = await supabase
    .from("tracks")
    .select("storage_bucket, storage_path")
    .eq("id", trackId)
    .single();

  if (!track) {
    return NextResponse.json({ error: "Faixa não encontrada" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(track.storage_bucket ?? "tracks")
    .createSignedUrl(track.storage_path, 60 * 30);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Erro ao gerar URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
