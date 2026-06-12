"use client";

import { useEffect } from "react";

import { checkTimeLogReminder } from "./time-actions";

export function TimeLogReminder() {
  useEffect(() => {
    checkTimeLogReminder();
  }, []);
  return null;
}
