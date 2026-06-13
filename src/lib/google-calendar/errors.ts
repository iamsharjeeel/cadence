/** Thrown when Google Calendar API returns 401 — user must reconnect. */
export class GCalReconnectRequiredError extends Error {
  readonly code = "gcal_reconnect_required" as const;

  constructor(message = "Google Calendar connection expired. Please reconnect.") {
    super(message);
    this.name = "GCalReconnectRequiredError";
  }
}

export const GCAL_RECONNECT_REQUIRED = "GCAL_RECONNECT_REQUIRED";

export function gcalReconnectRequiredError(
  message?: string,
): GCalReconnectRequiredError {
  return new GCalReconnectRequiredError(message);
}

export function isGCalReconnectRequiredError(err: unknown): boolean {
  if (err instanceof GCalReconnectRequiredError) return true;
  if (err instanceof Error) {
    return (
      err.message === GCAL_RECONNECT_REQUIRED ||
      err.message.includes("GCalReconnectRequired")
    );
  }
  return false;
}
