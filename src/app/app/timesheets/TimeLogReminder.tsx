"use client";

import { useEffect } from "react";

import { checkTimeLogReminder, checkTimesheetSubmitReminder } from "./time-actions";

export function TimeLogReminder() {
  useEffect(() => {
    checkTimeLogReminder();
    checkTimesheetSubmitReminder();
  }, []);
  return null;
}
