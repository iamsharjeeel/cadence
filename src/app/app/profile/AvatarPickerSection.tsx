"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { updateOwnAvatar, uploadProfileAvatar } from "./actions";

const PRESETS = [
  "/avatars/preset-1.svg",
  "/avatars/preset-2.svg",
  "/avatars/preset-3.svg",
  "/avatars/preset-4.svg",
  "/avatars/preset-5.svg",
];

export function AvatarPickerSection({
  currentAvatarUrl,
  name,
  email,
}: {
  currentAvatarUrl: string | null;
  name: string | null;
  email: string;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"presets" | "upload">("presets");
  const [pending, startTransition] = useTransition();
  const [optimisticUrl, setOptimisticUrl] = useState<string | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const displayUrl = optimisticUrl !== undefined ? optimisticUrl : currentAvatarUrl;

  function selectPreset(url: string) {
    setOptimisticUrl(url);
    startTransition(async () => {
      const res = await updateOwnAvatar(url);
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) setOptimisticUrl(undefined);
    });
  }

  function clearAvatar() {
    setOptimisticUrl(null);
    startTransition(async () => {
      const res = await updateOwnAvatar(null);
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) setOptimisticUrl(undefined);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const localPreview = URL.createObjectURL(file);
    setOptimisticUrl(localPreview);

    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadProfileAvatar(fd);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok && res.url) {
        setOptimisticUrl(res.url);
      } else {
        setOptimisticUrl(undefined);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      {/* Current avatar preview */}
      <div className="flex flex-col items-center gap-2">
        {displayUrl ? (
          <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-[var(--line)]">
            <Image
              src={displayUrl}
              alt="Your avatar"
              fill
              className="object-cover"
              unoptimized={displayUrl.startsWith("/avatars/")}
            />
          </div>
        ) : (
          <Avatar name={name} email={email} size={64} />
        )}
        {displayUrl && (
          <button
            type="button"
            onClick={clearAvatar}
            disabled={pending}
            className="text-xs text-muted transition-colors hover:text-[var(--danger)] disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {/* Picker tabs */}
      <div className="flex-1 min-w-0">
        <div className="mb-3 flex gap-1 rounded-full border border-[var(--line)] p-0.5 w-fit">
          {(["presets", "upload"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                tab === t
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {t === "presets" ? "Presets" : "Upload photo"}
            </button>
          ))}
        </div>

        {tab === "presets" ? (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => selectPreset(url)}
                disabled={pending}
                className={cn(
                  "relative h-12 w-12 overflow-hidden rounded-full ring-2 transition-all",
                  displayUrl === url
                    ? "ring-[var(--accent)] ring-offset-2 ring-offset-surface"
                    : "ring-[var(--line)] hover:ring-[var(--accent-soft)]",
                  "disabled:opacity-50",
                )}
                aria-label={`Select preset avatar ${PRESETS.indexOf(url) + 1}`}
              >
                <Image
                  src={url}
                  alt={`Preset ${PRESETS.indexOf(url) + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </Button>
              <span className="text-sm text-muted truncate max-w-[160px]">
                {fileName ?? "No file chosen"}
              </span>
            </div>
            <p className="text-xs text-muted">PNG, JPG, WebP or GIF · max 2 MB</p>
          </div>
        )}
      </div>
    </div>
  );
}
