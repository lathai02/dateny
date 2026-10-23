import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { consumeRateLimit, hasSameOrigin } from "@/lib/security/request";
import type { PlaceReview, ReviewsResponse } from "@/lib/reviews/types";

export const runtime = "nodejs";

const BUCKET = "review-images";
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type ReviewRow = {
  id: string;
  user_id: string;
  rating: number;
  body: string;
  author_name: string;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  review_images: Array<{ id: string; storage_path: string }> | null;
};

function jsonError(message: string, status: number, retryAfter?: number) {
  return Response.json({ error: message }, { status, headers: {
    "Cache-Control": "no-store",
    ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
  } });
}

function normalizeReview(row: ReviewRow, signedUrls: Map<string, string>, viewerId?: string): PlaceReview {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    authorName: row.author_name,
    ...(row.author_avatar_url && { authorAvatarUrl: row.author_avatar_url }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwn: row.user_id === viewerId,
    images: (row.review_images ?? [])
      .map((image) => ({ id: image.id, publicUrl: signedUrls.get(image.storage_path) }))
      .filter((image): image is { id: string; publicUrl: string } => Boolean(image.publicUrl)),
  };
}

async function hasValidImageSignature(image: File): Promise<boolean> {
  const bytes = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  if (image.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (image.type === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
  }
  if (image.type === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function GET(request: Request) {
  const retryAfter = consumeRateLimit(request, "reviews:read", 60, 60_000);
  if (retryAfter) return jsonError("Bạn thao tác quá nhanh. Hãy thử lại sau.", 429, retryAfter);
  const placeId = new URL(request.url).searchParams.get("placeId")?.trim();
  if (!placeId || placeId.length > 300) return jsonError("Mã quán không hợp lệ.", 400);
  if (!isSupabaseConfigured || !isSupabaseAdminConfigured) {
    const empty: ReviewsResponse = {
      enabled: false,
      setupIssue: isSupabaseConfigured ? "server_secret_missing" : "public_config_missing",
      averageRating: null,
      reviewCount: 0,
      reviews: [],
    };
    return Response.json(empty, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await admin
    .from("reviews")
    .select("id,user_id,rating,body,author_name,author_avatar_url,created_at,updated_at,review_images(id,storage_path)")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return jsonError("Chưa tải được đánh giá.", 502);
  const rows = (data ?? []) as ReviewRow[];
  const signedUrls = new Map<string, string>();
  const paths = rows.flatMap((row) => row.review_images ?? []).map((image) => image.storage_path);
  if (paths.length) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, 15 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedUrls.set(item.path, item.signedUrl);
    }
  }
  const reviews = rows.map((row) => normalizeReview(row, signedUrls, userData.user?.id));
  const averageRating = reviews.length
    ? Math.round((reviews.reduce((total, review) => total + review.rating, 0) / reviews.length) * 10) / 10
    : null;
  const response: ReviewsResponse = { enabled: true, averageRating, reviewCount: reviews.length, reviews };
  return Response.json(response, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return jsonError("Tính năng đánh giá chưa được cấu hình.", 503);
  if (!hasSameOrigin(request)) return jsonError("Yêu cầu không hợp lệ.", 403);
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) return jsonError("Bạn cần đăng nhập để đánh giá.", 401);
  const ipRetry = consumeRateLimit(request, "reviews:write-ip", 20, 10 * 60_000);
  const userRetry = consumeRateLimit(request, "reviews:write-user", 6, 10 * 60_000, user.id);
  const retryAfter = Math.max(ipRetry ?? 0, userRetry ?? 0);
  if (retryAfter) return jsonError("Bạn đã gửi quá nhiều thay đổi. Hãy thử lại sau.", 429, retryAfter);
  if (!isSupabaseAdminConfigured) return jsonError("Máy chủ đánh giá chưa có khóa bảo mật.", 503);
  const admin = createAdminClient();
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 21 * 1024 * 1024) {
    return jsonError("Tổng dung lượng tải lên quá lớn.", 413);
  }

  const form = await request.formData();
  const placeId = String(form.get("placeId") ?? "").trim();
  const placeName = String(form.get("placeName") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const rating = Number(form.get("rating"));
  const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);

  if (!placeId || placeId.length > 300 || !placeName || placeName.length > 200) {
    return jsonError("Thông tin quán không hợp lệ.", 400);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return jsonError("Số sao phải từ 1 đến 5.", 400);
  if (body.length < 10 || body.length > 1_000) return jsonError("Nội dung cần từ 10 đến 1.000 ký tự.", 400);
  if (images.length > MAX_IMAGES) return jsonError(`Chỉ được tải tối đa ${MAX_IMAGES} ảnh.`, 400);
  for (const image of images) {
    if (!IMAGE_EXTENSIONS[image.type]) return jsonError("Ảnh phải là JPEG, PNG hoặc WebP.", 400);
    if (image.size > MAX_IMAGE_BYTES) return jsonError("Mỗi ảnh không được vượt quá 5 MB.", 400);
    if (!await hasValidImageSignature(image)) return jsonError("Nội dung tệp không đúng định dạng ảnh.", 400);
  }

  // Reviews use a stable pseudonym instead of publishing OAuth names, emails, or avatars.
  const authorName = `Thành viên ${user.id.replaceAll("-", "").slice(0, 4).toUpperCase()}`;

  const { data: existing } = await admin
    .from("reviews")
    .select("id,review_images(id,storage_path)")
    .eq("place_id", placeId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: saved, error: saveError } = await admin
    .from("reviews")
    .upsert({
      place_id: placeId,
      place_name: placeName,
      user_id: user.id,
      rating,
      body,
      author_name: authorName,
      author_avatar_url: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "place_id,user_id" })
    .select("id")
    .single();

  if (saveError || !saved) return jsonError("Chưa lưu được đánh giá.", 502);

  if (images.length) {
    const oldImages = (existing?.review_images ?? []) as Array<{ id: string; storage_path: string }>;
    const uploadedPaths: string[] = [];
    const imageRows: Array<{ review_id: string; storage_path: string; sort_order: number }> = [];
    for (const [index, image] of images.entries()) {
      const path = `${user.id}/${saved.id}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[image.type]}`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, image, {
        contentType: image.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) {
        if (uploadedPaths.length) await admin.storage.from(BUCKET).remove(uploadedPaths);
        return jsonError("Đánh giá đã lưu nhưng chưa tải được ảnh. Hãy thử lại.", 502);
      }
      uploadedPaths.push(path);
      imageRows.push({ review_id: saved.id, storage_path: path, sort_order: index });
    }
    const { error: imageError } = await admin.from("review_images").insert(imageRows);
    if (imageError) {
      await admin.storage.from(BUCKET).remove(uploadedPaths);
      return jsonError("Đánh giá đã lưu nhưng chưa liên kết được ảnh.", 502);
    }
    // Only remove the previous set after every new image is safely stored and linked.
    if (oldImages.length) {
      await admin.from("review_images").delete().in("id", oldImages.map((image) => image.id));
      await admin.storage.from(BUCKET).remove(oldImages.map((image) => image.storage_path));
    }
  }

  return Response.json({ ok: true, reviewId: saved.id });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured) return jsonError("Tính năng đánh giá chưa được cấu hình.", 503);
  if (!hasSameOrigin(request)) return jsonError("Yêu cầu không hợp lệ.", 403);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return jsonError("Bạn cần đăng nhập.", 401);
  const ipRetry = consumeRateLimit(request, "reviews:delete-ip", 10, 10 * 60_000);
  const userRetry = consumeRateLimit(request, "reviews:delete-user", 5, 10 * 60_000, user.id);
  const retryAfter = Math.max(ipRetry ?? 0, userRetry ?? 0);
  if (retryAfter) return jsonError("Bạn đã gửi quá nhiều thay đổi. Hãy thử lại sau.", 429, retryAfter);
  if (!isSupabaseAdminConfigured) return jsonError("Máy chủ đánh giá chưa có khóa bảo mật.", 503);
  const admin = createAdminClient();
  const payload = await request.json().catch(() => null) as { placeId?: unknown } | null;
  const placeId = typeof payload?.placeId === "string" ? payload.placeId.trim() : "";
  if (!placeId || placeId.length > 300) return jsonError("Mã quán không hợp lệ.", 400);

  const { data: existing } = await admin
    .from("reviews")
    .select("id,review_images(storage_path)")
    .eq("place_id", placeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return jsonError("Không tìm thấy đánh giá.", 404);

  const paths = (existing.review_images ?? []).map((image: { storage_path: string }) => image.storage_path);
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  const { error } = await admin.from("reviews").delete().eq("id", existing.id).eq("user_id", user.id);
  if (error) return jsonError("Chưa xóa được đánh giá.", 502);
  return Response.json({ ok: true });
}
