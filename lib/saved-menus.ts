import { supabase } from "@/lib/supabase/client";
import { menuImageAlt } from "@/lib/menu-image-alt";

export type SavedMenuKind = "bento" | "izakaya";
export type ImageStatus = "pending" | "ready" | "failed";

export type SavedMenuSummary = {
  id: string;
  kind: SavedMenuKind;
  source_id: string;
  name: string;
  cuisine: string;
  tagline: string | null;
  price_yen: number;
  image_status: ImageStatus;
  image_path: string | null;
  image_alt: string;
  created_at: string;
  imageUrl?: string;
};

export type SavedMenuDetail = SavedMenuSummary & {
  payload: Record<string, unknown>;
};

const bucket = "saved-menu-images";

export async function ensureMenuLibraryUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("保存用ライブラリを準備できませんでした。");
  return data.user;
}

function menuFields(kind: SavedMenuKind, suggestion: Record<string, unknown>) {
  const name = String(suggestion.name ?? "名称未設定");
  return {
    source_id: String(suggestion.id ?? crypto.randomUUID()),
    name,
    cuisine: String(suggestion.cuisine ?? "mixed"),
    tagline: typeof suggestion.tagline === "string" ? suggestion.tagline : null,
    price_yen: Math.max(0, Number(suggestion.basePrice ?? 0) || 0),
    image_alt: menuImageAlt(kind, name),
  };
}

export async function createSavedMenu(kind: SavedMenuKind, suggestion: Record<string, unknown>) {
  const user = await ensureMenuLibraryUser();
  const fields = menuFields(kind, suggestion);
  const { data, error } = await supabase.from("saved_menus").upsert({
    owner_id: user.id,
    kind,
    ...fields,
    schema_version: 1,
    payload: suggestion,
  }, { onConflict: "owner_id,kind,source_id", ignoreDuplicates: true }).select("id,image_status").single();
  if (!error && data) return data as { id: string; image_status: ImageStatus };

  const { data: existing, error: existingError } = await supabase.from("saved_menus")
    .select("id,image_status")
    .eq("owner_id", user.id).eq("kind", kind).eq("source_id", fields.source_id).single();
  if (existingError || !existing) throw error ?? existingError ?? new Error("メニューを保存できませんでした。");
  return existing as { id: string; image_status: ImageStatus };
}

export async function attachSavedMenuImage(id: string, image: Blob) {
  const user = await ensureMenuLibraryUser();
  if (image.size > 10 * 1024 * 1024) throw new Error("画像サイズが10MBを超えています。");
  if (!['image/webp', 'image/png', 'image/jpeg'].includes(image.type)) throw new Error("保存できない画像形式です。");
  const extension = image.type === "image/png" ? "png" : image.type === "image/jpeg" ? "jpg" : "webp";
  const imagePath = `${user.id}/${id}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(imagePath, image, {
    contentType: image.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("saved_menus").update({ image_path: imagePath, image_status: "ready" }).eq("id", id);
  if (error) throw error;
}

export async function markSavedMenuImageFailed(id: string) {
  await ensureMenuLibraryUser();
  await supabase.from("saved_menus").update({ image_status: "failed" }).eq("id", id);
}

async function addSignedImages<T extends SavedMenuSummary>(menus: T[]) {
  const paths = menus.flatMap((menu) => menu.image_path ? [menu.image_path] : []);
  if (!paths.length) return menus;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const urls = new Map(paths.map((path, index) => [path, data[index]?.signedUrl]));
  return menus.map((menu) => ({ ...menu, imageUrl: menu.image_path ? urls.get(menu.image_path) : undefined }));
}

export async function listSavedMenus(kind?: SavedMenuKind) {
  await ensureMenuLibraryUser();
  let query = supabase.from("saved_menus")
    .select("id,kind,source_id,name,cuisine,tagline,price_yen,image_status,image_path,image_alt,created_at")
    .order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return addSignedImages((data ?? []) as SavedMenuSummary[]);
}

export async function getSavedMenu(id: string) {
  await ensureMenuLibraryUser();
  const { data, error } = await supabase.from("saved_menus")
    .select("id,kind,source_id,name,cuisine,tagline,price_yen,payload,image_status,image_path,image_alt,created_at")
    .eq("id", id).single();
  if (error) throw error;
  const [menu] = await addSignedImages([data as SavedMenuDetail]);
  return menu;
}
