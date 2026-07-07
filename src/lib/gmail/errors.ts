export class GmailReconnectRequiredError extends Error {
  readonly code = "gmail_reconnect_required" as const;

  constructor(message = "Gmail connection expired. Please reconnect.") {
    super(message);
    this.name = "GmailReconnectRequiredError";
  }
}

export const GMAIL_RECONNECT_REQUIRED = "GMAIL_RECONNECT_REQUIRED";

export function gmailReconnectRequiredError(
  message?: string,
): GmailReconnectRequiredError {
  return new GmailReconnectRequiredError(message);
}

export function isGmailReconnectRequiredError(err: unknown): boolean {
  if (err instanceof GmailReconnectRequiredError) return true;
  if (err instanceof Error) {
    return (
      err.message === GMAIL_RECONNECT_REQUIRED ||
      err.message.includes("GmailReconnectRequired")
    );
  }
  return false;
}
