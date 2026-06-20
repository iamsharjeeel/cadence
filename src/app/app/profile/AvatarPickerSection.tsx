"use client";

import { useState, useTransition } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  AVATAR_PRESETS,
  resolveAvatarUrl,
  type AvatarPreset,
} from "@/lib/avatar-url";
import { updateOwnAvatar } from "./actions";

export function AvatarPickerSection({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(avatarUrl);
  const [pending, startTransition] = useTransition();

  function selectPreset(presetPath: AvatarPreset) {
    const previous = selected;
    setSelected(presetPath);
    startTransition(async () => {
      const result = await updateOwnAvatar(presetPath);
      if (!result.ok) {
        setSelected(previous);
        toast(result.message, "error");
        return;
      }
      toast(result.message, "success");
    });
  }

  const displaySrc = resolveAvatarUrl(selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar name={name} email={email} src={displaySrc} size={56} />
        <p className="text-sm text-muted">
          Choose a preset avatar or keep your initials.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {AVATAR_PRESETS.map((preset) => {
          const isActive = selected === preset;
          return (
            <button
              key={preset}
              type="button"
              disabled={pending}
              aria-label={`Select avatar ${preset}`}
              aria-pressed={isActive}
              onClick={() => selectPreset(preset)}
              className={cn(
                "rounded-full p-0.5 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]",
                isActive && "ring-2 ring-[var(--accent)]",
                pending && "opacity-60",
              )}
            >
              <Avatar
                name={name}
                email={email}
                src={preset}
                size={40}
                className="pointer-events-none"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
