"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/use-auth";
import { oauthRedirectUrl, type OAuthProvider } from "@/features/auth/oauth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Place } from "@/lib/places/types";
import type { PlaceReview, ReviewsResponse } from "@/lib/reviews/types";

const EMPTY_RESPONSE: ReviewsResponse = {
  enabled: isSupabaseConfigured,
  averageRating: null,
  reviewCount: 0,
  reviews: [],
};

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function Avatar({ review }: { review: PlaceReview }) {
  const initial =
    review.authorName.trim().charAt(0).toLocaleUpperCase("vi") || "D";
  return (
    <span
      className="review-avatar"
      style={
        review.authorAvatarUrl
          ? {
              backgroundImage: `url(${JSON.stringify(review.authorAvatarUrl).slice(1, -1)})`,
            }
          : undefined
      }
      aria-hidden="true"
    >
      {!review.authorAvatarUrl && initial}
    </span>
  );
}

export function PlaceReviews({
  place,
  onSummaryChange,
}: {
  place: Place;
  onSummaryChange?: (summary: {
    averageRating: number | null;
    reviewCount: number;
  }) => void;
}) {
  const { user, ready: authReady, supabase } = useAuth();
  const userId = user?.id;
  const requestRef = useRef<AbortController | null>(null);
  const [data, setData] = useState<ReviewsResponse>(EMPTY_RESPONSE);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [formState, setFormState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const loadReviews = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadState("loading");
    try {
      const response = await fetch(
        `/api/reviews?placeId=${encodeURIComponent(place.id)}`,
        { cache: "no-store", signal: controller.signal },
      );
      const payload = (await response.json()) as
        ReviewsResponse | { error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok || !("reviews" in payload))
        throw new Error(
          "error" in payload ? payload.error : "Chưa tải được đánh giá.",
        );
      setData(payload);
      onSummaryChange?.({
        averageRating: payload.averageRating,
        reviewCount: payload.reviewCount,
      });
      const currentUserReview = payload.reviews.find((review) => review.isOwn);
      setRating(currentUserReview?.rating ?? 0);
      setBody(currentUserReview?.body ?? "");
      setLoadState("ready");
    } catch {
      if (!controller.signal.aborted) setLoadState("error");
    }
  }, [onSummaryChange, place.id]);

  useEffect(() => {
    if (!authReady) return;
    const frame = window.requestAnimationFrame(() => void loadReviews());
    return () => {
      window.cancelAnimationFrame(frame);
      requestRef.current?.abort();
    };
  }, [loadReviews, userId, authReady]);

  const ownReview = data.reviews.find((review) => review.isOwn);
  useEffect(
    () => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)),
    [previewUrls],
  );

  async function signIn(provider: OAuthProvider) {
    if (!supabase) return;
    const redirectTo = oauthRedirectUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setFormState("error");
      setMessage("Chưa thể mở trang đăng nhập.");
    }
  }

  function selectImages(files: FileList | null) {
    const selected = files ? Array.from(files) : [];
    if (selected.length > 4) {
      setFormState("error");
      setMessage("Chỉ được chọn tối đa 4 ảnh.");
      return;
    }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      setFormState("error");
      setMessage("Mỗi ảnh không được vượt quá 5 MB.");
      return;
    }
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setImages(selected);
    setPreviewUrls(selected.map((file) => URL.createObjectURL(file)));
    setFormState("idle");
    setMessage("");
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || rating < 1 || body.trim().length < 10) {
      setFormState("error");
      setMessage(
        rating < 1 ? "Hãy chọn số sao." : "Hãy viết ít nhất 10 ký tự.",
      );
      return;
    }
    setFormState("saving");
    setMessage("");
    const form = new FormData();
    form.set("placeId", place.id);
    form.set("placeName", place.name);
    form.set("rating", String(rating));
    form.set("body", body.trim());
    images.forEach((image) => form.append("images", image));
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Chưa lưu được đánh giá.");
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      setImages([]);
      setPreviewUrls([]);
      setFileInputKey((value) => value + 1);
      setFormState("success");
      setMessage(ownReview ? "Đã cập nhật đánh giá." : "Đã đăng đánh giá.");
      await loadReviews();
    } catch (error) {
      setFormState("error");
      setMessage(
        error instanceof Error ? error.message : "Chưa lưu được đánh giá.",
      );
    }
  }

  async function deleteReview() {
    if (!window.confirm("Xóa đánh giá và toàn bộ ảnh của bạn?")) return;
    setFormState("saving");
    const response = await fetch("/api/reviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: place.id }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setFormState("error");
      setMessage(payload.error ?? "Chưa xóa được đánh giá.");
      return;
    }
    setRating(0);
    setBody("");
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setImages([]);
    setPreviewUrls([]);
    setFormState("success");
    setMessage("Đã xóa đánh giá.");
    await loadReviews();
  }

  if (!data.enabled && loadState !== "loading") {
    return (
      <section className="reviews-section reviews-setup">
        <h3>Đánh giá cộng đồng</h3>
        {data.setupIssue === "server_secret_missing" ? (
          <p>
            Thiếu khóa máy chủ <code>SUPABASE_SECRET_KEY</code> trong{" "}
            <code>.env.local</code>. Thêm khóa <code>sb_secret_...</code> rồi
            khởi động lại ứng dụng.
          </p>
        ) : (
          <p>
            Thiếu cấu hình Supabase public trong <code>.env.local</code>. Cần
            URL dự án và publishable key để bật đăng nhập.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="reviews-section" aria-labelledby="reviews-title">
      <div className="reviews-heading">
        <div>
          <span className="overline">Cộng đồng</span>
          <h3 id="reviews-title">Đánh giá quán</h3>
        </div>
        <div
          className="rating-summary"
          aria-label={
            data.averageRating
              ? `${data.averageRating} trên 5 sao`
              : "Chưa có đánh giá"
          }
        >
          <Star size={19} fill="currentColor" aria-hidden="true" />
          <strong>{data.averageRating ?? "—"}</strong>
          <span>({data.reviewCount})</span>
        </div>
      </div>

      {loadState === "loading" && (
        <p className="reviews-status" role="status">
          <LoaderCircle className="spin" size={18} />
          Đang tải đánh giá…
        </p>
      )}
      {loadState === "error" && (
        <p className="reviews-status is-error" role="alert">
          Chưa tải được đánh giá. <button onClick={loadReviews}>Thử lại</button>
        </p>
      )}

      {loadState === "ready" && data.reviews.length > 0 && (
        <div className="review-list">
          {data.reviews.map((review) => (
            <article className="review-card" key={review.id}>
              <header>
                <Avatar review={review} />
                <span>
                  <strong>{review.authorName}</strong>
                  <small>
                    {formattedDate(review.updatedAt)}
                    {review.isOwn ? " · Của bạn" : ""}
                  </small>
                </span>
                <span
                  className="review-stars"
                  aria-label={`${review.rating} sao`}
                >
                  {"★".repeat(review.rating)}
                  <i>{"★".repeat(5 - review.rating)}</i>
                </span>
              </header>
              <p>{review.body}</p>
              {review.images.length > 0 && (
                <div className="review-images">
                  {review.images.map((image) => (
                    <a
                      key={image.id}
                      href={image.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Mở ảnh đánh giá"
                    >
                      <span
                        style={{
                          backgroundImage: `url(${JSON.stringify(image.publicUrl).slice(1, -1)})`,
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {user ? (
        <form className="review-form" onSubmit={submitReview}>
          <div className="review-form-title">
            <strong>
              {ownReview ? "Sửa đánh giá của bạn" : "Viết đánh giá"}
            </strong>
            {ownReview && (
              <button
                type="button"
                onClick={deleteReview}
                disabled={formState === "saving"}
              >
                <Trash2 size={16} />
                Xóa
              </button>
            )}
          </div>
          <fieldset>
            <legend>Mức độ hài lòng</legend>
            <div className="star-picker">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={value <= rating ? "is-active" : ""}
                  onClick={() => setRating(value)}
                  aria-label={`${value} sao`}
                  aria-pressed={value === rating}
                >
                  <Star
                    size={25}
                    fill={value <= rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="review-text">
            <span>Chia sẻ trải nghiệm</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={10}
              maxLength={1_000}
              placeholder="Không gian, món ăn, phục vụ…"
              required
            />
            <small>{body.length}/1.000</small>
          </label>
          <label className="review-photo-input">
            <Camera size={18} aria-hidden="true" />
            <span>
              {images.length
                ? `${images.length} ảnh đã chọn`
                : ownReview?.images.length
                  ? "Chọn ảnh mới để thay ảnh cũ"
                  : "Thêm tối đa 4 ảnh"}
            </span>
            <input
              key={fileInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => selectImages(event.target.files)}
            />
          </label>
          {previewUrls.length > 0 && (
            <div className="review-previews">
              {previewUrls.map((url) => (
                <span key={url} style={{ backgroundImage: `url(${url})` }} />
              ))}
            </div>
          )}
          <button
            className="review-submit"
            disabled={
              formState === "saving" || rating === 0 || body.trim().length < 10
            }
          >
            {formState === "saving" ? (
              <>
                <LoaderCircle className="spin" size={18} />
                Đang lưu…
              </>
            ) : ownReview ? (
              "Cập nhật đánh giá"
            ) : (
              "Đăng đánh giá"
            )}
          </button>
          {message && (
            <p
              className={`review-message ${formState === "error" ? "is-error" : ""}`}
              role={formState === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          )}
        </form>
      ) : (
        <div className="review-login">
          <strong>Đăng nhập để đánh giá</strong>
          <p>
            Email, tên thật và ảnh đại diện của bạn được giữ riêng tư; review
            chỉ hiển thị một bí danh.
          </p>
          <div>
            <button onClick={() => signIn("google")}>
              <span className="provider-mark provider-google">G</span>Google
            </button>
            <button onClick={() => signIn("facebook")}>
              <span className="provider-mark provider-facebook">f</span>Facebook
            </button>
          </div>
          {message && (
            <p className="review-message is-error" role="alert">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
