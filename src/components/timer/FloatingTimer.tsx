"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { ProjectPicker } from "@/components/time/ProjectPicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MotionModal } from "@/components/motion/MotionModal";
import { useToast } from "@/components/ui/Toast";
import {
  formatElapsed,
  timerProjectName,
  useTimer,
} from "@/contexts/TimerContext";
import { cn } from "@/lib/utils";
import { saveTimerEntries } from "@/app/app/timer-actions";
import { splitTimerAtMidnight } from "@/lib/timer-utils";

function ModalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-lg font-semibold text-ink">
      {children}
    </h2>
  );
}

type TimerPosition = { x: number; y: number };

const EDGE_PADDING = 16;
const STORAGE_KEY_PREFIX = "cadence:timer-widget-position:v1:";

function clampPositionToViewport(
  value: TimerPosition,
  width: number,
  height: number,
): TimerPosition {
  const maxX = Math.max(EDGE_PADDING, window.innerWidth - width - EDGE_PADDING);
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - height - EDGE_PADDING);
  return {
    x: Math.min(Math.max(value.x, EDGE_PADDING), maxX),
    y: Math.min(Math.max(value.y, EDGE_PADDING), maxY),
  };
}

export function FloatingTimer({ userId }: { userId: string }) {
  const {
    running,
    elapsedSeconds,
    expanded,
    setExpanded,
    projects,
    asanaProjects,
    hasAsana,
    projectsLoaded,
    loadProjects,
    startTimer,
    stopTimer,
    discardTimer,
    updateProject,
    updateDescription,
    showProjectPrompt,
    setShowProjectPrompt,
    conflictPrompt,
    confirmStopAndStart,
    cancelConflict,
    idlePromptMinutes,
    acknowledgeIdle,
    resetStartedAt,
  } = useTimer();

  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const midnightHandledRef = useRef<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const [position, setPosition] = useState<TimerPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;

  const clampWithCurrentSize = useCallback((value: TimerPosition) => {
    const rect = widgetRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 320;
    const height = rect?.height ?? 56;
    return clampPositionToViewport(value, width, height);
  }, []);

  useEffect(() => {
    if (!running && !showProjectPrompt) return;
    if (!projectsLoaded) void loadProjects();
  }, [running, showProjectPrompt, projectsLoaded, loadProjects]);

  useEffect(() => {
    if (position !== null) return;
    const raf = window.requestAnimationFrame(() => {
      let initial: TimerPosition | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<TimerPosition>;
          if (
            typeof parsed?.x === "number" &&
            Number.isFinite(parsed.x) &&
            typeof parsed?.y === "number" &&
            Number.isFinite(parsed.y)
          ) {
            initial = clampWithCurrentSize({ x: parsed.x, y: parsed.y });
          }
        }
      } catch {
        initial = null;
      }

      if (!initial) {
        const rect = widgetRef.current?.getBoundingClientRect();
        const width = rect?.width ?? 320;
        const height = rect?.height ?? 56;
        initial = clampPositionToViewport(
          {
            x: window.innerWidth - width - EDGE_PADDING,
            y: window.innerHeight - height - EDGE_PADDING,
          },
          width,
          height,
        );
      }

      setPosition(initial);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [position, storageKey, clampWithCurrentSize]);

  useEffect(() => {
    if (position === null) return;
    const onResize = () => {
      setPosition((prev) => (prev ? clampWithCurrentSize(prev) : prev));
    };
    window.addEventListener("resize", onResize);
    const raf = window.requestAnimationFrame(onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [position, clampWithCurrentSize, running, expanded]);

  useEffect(() => {
    if (!position || dragging) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(position));
    } catch {
      // Best effort: if storage is unavailable, position still works in-session.
    }
  }, [position, dragging, storageKey]);

  const persistTimer = useCallback(
    async (timer: NonNullable<typeof running>) => {
      setSaving(true);
      try {
        const endedAt = new Date();
        const startedAt = new Date(timer.startedAt);
        const segments = splitTimerAtMidnight(startedAt, endedAt);
        const result = await saveTimerEntries({
          segments,
          projectId: timer.project.projectId,
          description: timer.description,
          billable: timer.billable,
        });
        toast(result.message, result.ok ? "success" : "error");
        return result.ok;
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  const handleStopAndSave = useCallback(async () => {
    const current = stopTimer();
    if (!current) return;
    await persistTimer(current);
  }, [stopTimer, persistTimer]);

  useEffect(() => {
    if (!running) {
      midnightHandledRef.current = null;
      return;
    }
    const id = window.setInterval(() => {
      const started = new Date(running.startedAt);
      const now = new Date();
      const startDay = started.toDateString();
      const today = now.toDateString();
      if (startDay !== today && midnightHandledRef.current !== today) {
        midnightHandledRef.current = today;
        void (async () => {
          const endOfPrev = new Date(started);
          endOfPrev.setHours(23, 59, 59, 0);
          const firstSegments = splitTimerAtMidnight(started, endOfPrev);
          const result = await saveTimerEntries({
            segments: firstSegments,
            projectId: running.project.projectId,
            description: running.description,
            billable: running.billable,
          });
          if (result.ok) {
            toast("Timer crossed midnight — previous day saved.", "success");
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            resetStartedAt(startOfToday.getTime());
          } else {
            toast(result.message, "error");
          }
        })();
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [running, toast, resetStartedAt]);

  const projectName = running
    ? timerProjectName(running.project, projects, asanaProjects)
    : null;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !position) return;
      const target = event.target as HTMLElement;
      if (target.closest("button, input, textarea, select, a")) return;
      const rect = widgetRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - position.x,
        offsetY: event.clientY - position.y,
        width: rect.width,
        height: rect.height,
      };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [position],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const next = clampPositionToViewport(
        {
          x: event.clientX - drag.offsetX,
          y: event.clientY - drag.offsetY,
        },
        drag.width,
        drag.height,
      );
      setPosition(next);
    },
    [],
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  return (
    <>
      <div
        ref={widgetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={cn(
          "fixed z-[60] touch-none select-none",
          position ? "left-0 top-0" : "bottom-6 right-6",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={
          position
            ? { transform: `translate3d(${position.x}px, ${position.y}px, 0)` }
            : undefined
        }
      >
        <div
          className={cn(
            "pointer-events-auto overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-lg",
            "dark:border-[var(--line)]",
            expanded && running ? "w-80" : "w-auto",
          )}
        >
          {running && expanded && (
            <div className="border-b px-4 py-3">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-left text-sm font-medium text-ink hover:text-[var(--accent-strong)]"
              >
                {projectName ?? "Add project…"}
              </button>
              <Input
                value={running.description}
                onChange={(e) => updateDescription(e.target.value)}
                placeholder="Description (optional)"
                className="mt-2 h-8 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-3 px-3 py-2.5">
            {running && (
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--accent)]"
                aria-hidden
              />
            )}
            <span className="font-display tabular-nums text-lg text-ink">
              {formatElapsed(elapsedSeconds)}
            </span>
            {running ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => void handleStopAndSave()}
                aria-label="Stop timer"
              >
                <Pause className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={startTimer} aria-label="Start timer">
                <Play className="h-4 w-4" />
              </Button>
            )}
            {running && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted hover:text-ink"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
            )}
          </div>
        </div>
      </div>

      <MotionModal
        open={showProjectPrompt && Boolean(running)}
        onClose={() => setShowProjectPrompt(false)}
        panelClassName="max-w-md"
      >
        <ModalTitle>What are you working on?</ModalTitle>
        <p className="mb-4 text-sm text-muted">
          Pick a project for this timer session. You can skip and assign later.
        </p>
        <ProjectPicker
          hasAsana={hasAsana}
          asanaProjects={asanaProjects}
          cadenceProjects={projects}
          projectId={running?.project.projectId ?? null}
          asanaProjectId={running?.project.asanaProjectId ?? null}
          onChange={(v) => updateProject(v)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowProjectPrompt(false)}>
            Skip for now
          </Button>
        </div>
      </MotionModal>

      <MotionModal
        open={pickerOpen && Boolean(running)}
        onClose={() => setPickerOpen(false)}
        panelClassName="max-w-md"
      >
        <ModalTitle>Change project</ModalTitle>
        <ProjectPicker
          hasAsana={hasAsana}
          asanaProjects={asanaProjects}
          cadenceProjects={projects}
          projectId={running?.project.projectId ?? null}
          asanaProjectId={running?.project.asanaProjectId ?? null}
          onChange={(v) => {
            updateProject(v);
            setPickerOpen(false);
          }}
        />
      </MotionModal>

      <MotionModal
        open={Boolean(conflictPrompt)}
        onClose={cancelConflict}
        panelClassName="max-w-md"
      >
        <ModalTitle>Timer already running</ModalTitle>
        <p className="text-sm text-muted">
          You have a timer running for{" "}
          <strong className="text-ink">{conflictPrompt}</strong>. Stop it and
          start a new one?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={cancelConflict}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void (async () => {
                const current = stopTimer();
                if (current) await persistTimer(current);
                confirmStopAndStart();
              })();
            }}
          >
            Stop and start new
          </Button>
        </div>
      </MotionModal>

      <MotionModal
        open={idlePromptMinutes !== null}
        onClose={acknowledgeIdle}
        panelClassName="max-w-md"
      >
        <ModalTitle>Still working?</ModalTitle>
        <p className="text-sm text-muted">
          The timer has been running for{" "}
          <strong className="text-ink">{idlePromptMinutes}</strong> minutes with
          no activity.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={discardTimer}>
            Discard
          </Button>
          <Button variant="secondary" onClick={() => void handleStopAndSave()}>
            Stop and save
          </Button>
          <Button onClick={acknowledgeIdle}>Yes, keep going</Button>
        </div>
      </MotionModal>
    </>
  );
}
