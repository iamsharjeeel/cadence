"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AsanaImportedProject } from "@/types/db";
import type { Project } from "@/types/time-tracking";

export type TimerProjectValue = {
  projectId: string | null;
  asanaProjectId: string | null;
};

export type RunningTimer = {
  startedAt: number;
  project: TimerProjectValue;
  description: string;
  billable: boolean;
};

type TimerContextValue = {
  running: RunningTimer | null;
  elapsedSeconds: number;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  projects: Project[];
  asanaProjects: AsanaImportedProject[];
  hasAsana: boolean;
  projectsLoaded: boolean;
  loadProjects: () => Promise<void>;
  startTimer: () => void;
  stopTimer: () => RunningTimer | null;
  discardTimer: () => void;
  updateProject: (value: TimerProjectValue) => void;
  updateDescription: (description: string) => void;
  updateBillable: (billable: boolean) => void;
  showProjectPrompt: boolean;
  setShowProjectPrompt: (v: boolean) => void;
  conflictPrompt: string | null;
  confirmStopAndStart: () => void;
  cancelConflict: () => void;
  idlePromptMinutes: number | null;
  acknowledgeIdle: () => void;
  idleDiscard: () => void;
  resetStartedAt: (ms: number) => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

const IDLE_MS = 30 * 60 * 1000;

function projectLabel(
  value: TimerProjectValue,
  projects: Project[],
  asanaProjects: AsanaImportedProject[],
): string | null {
  if (value.projectId) {
    return projects.find((p) => p.id === value.projectId)?.name ?? null;
  }
  if (value.asanaProjectId) {
    return (
      asanaProjects.find((p) => p.id === value.asanaProjectId)
        ?.asana_project_name ?? null
    );
  }
  return null;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState<RunningTimer | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showProjectPrompt, setShowProjectPrompt] = useState(false);
  const [conflictPrompt, setConflictPrompt] = useState<string | null>(null);
  const [idlePromptMinutes, setIdlePromptMinutes] = useState<number | null>(
    null,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [asanaProjects, setAsanaProjects] = useState<AsanaImportedProject[]>(
    [],
  );
  const [hasAsana, setHasAsana] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const lastInteraction = useRef(Date.now());
  const midnightHandled = useRef<string | null>(null);
  const pendingStart = useRef(false);

  const loadProjects = useCallback(async () => {
    const { fetchTimerProjects } = await import("@/app/app/timer-actions");
    const data = await fetchTimerProjects();
    setProjects(data.projects);
    setAsanaProjects(data.asanaProjects);
    setHasAsana(data.hasAsana);
    setProjectsLoaded(true);
  }, []);

  useEffect(() => {
    if (!running) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - running.startedAt) / 1000)),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    const bump = () => {
      lastInteraction.current = Date.now();
      if (idlePromptMinutes !== null) setIdlePromptMinutes(null);
    };
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [idlePromptMinutes]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const idleFor = Date.now() - lastInteraction.current;
      if (idleFor >= IDLE_MS && idlePromptMinutes === null) {
        setIdlePromptMinutes(Math.floor(idleFor / 60000));
      }
    }, 15000);
    return () => window.clearInterval(id);
  }, [running, idlePromptMinutes]);

  const beginRunning = useCallback(() => {
    setRunning({
      startedAt: Date.now(),
      project: { projectId: null, asanaProjectId: null },
      description: "",
      billable: true,
    });
    setShowProjectPrompt(true);
    setExpanded(true);
    lastInteraction.current = Date.now();
    midnightHandled.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (running) {
      const label =
        projectLabel(running.project, projects, asanaProjects) ??
        "No project";
      setConflictPrompt(label);
      pendingStart.current = true;
      return;
    }
    beginRunning();
  }, [running, projects, asanaProjects, beginRunning]);

  const stopTimer = useCallback(() => {
    const current = running;
    setRunning(null);
    setShowProjectPrompt(false);
    setIdlePromptMinutes(null);
    setConflictPrompt(null);
    pendingStart.current = false;
    return current;
  }, [running]);

  const discardTimer = useCallback(() => {
    setRunning(null);
    setShowProjectPrompt(false);
    setIdlePromptMinutes(null);
    setConflictPrompt(null);
    pendingStart.current = false;
  }, []);

  const confirmStopAndStart = useCallback(() => {
    setConflictPrompt(null);
    setRunning(null);
    if (pendingStart.current) {
      pendingStart.current = false;
      beginRunning();
    }
  }, [beginRunning]);

  const cancelConflict = useCallback(() => {
    setConflictPrompt(null);
    pendingStart.current = false;
  }, []);

  const updateProject = useCallback((value: TimerProjectValue) => {
    setRunning((prev) => (prev ? { ...prev, project: value } : prev));
    setShowProjectPrompt(false);
  }, []);

  const updateDescription = useCallback((description: string) => {
    setRunning((prev) => (prev ? { ...prev, description } : prev));
  }, []);

  const updateBillable = useCallback((billable: boolean) => {
    setRunning((prev) => (prev ? { ...prev, billable } : prev));
  }, []);

  const acknowledgeIdle = useCallback(() => {
    lastInteraction.current = Date.now();
    setIdlePromptMinutes(null);
  }, []);

  const resetStartedAt = useCallback((ms: number) => {
    setRunning((prev) => (prev ? { ...prev, startedAt: ms } : prev));
    lastInteraction.current = Date.now();
  }, []);

  const value = useMemo(
    () => ({
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
      updateBillable,
      showProjectPrompt,
      setShowProjectPrompt,
      conflictPrompt,
      confirmStopAndStart,
      cancelConflict,
      idlePromptMinutes,
      acknowledgeIdle,
      idleDiscard: discardTimer,
      resetStartedAt,
    }),
    [
      running,
      elapsedSeconds,
      expanded,
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
      updateBillable,
      showProjectPrompt,
      conflictPrompt,
      confirmStopAndStart,
      cancelConflict,
      idlePromptMinutes,
      acknowledgeIdle,
      resetStartedAt,
    ],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useTimer must be used within TimerProvider");
  }
  return ctx;
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function timerProjectName(
  value: TimerProjectValue,
  projects: Project[],
  asanaProjects: AsanaImportedProject[],
): string | null {
  return projectLabel(value, projects, asanaProjects);
}
