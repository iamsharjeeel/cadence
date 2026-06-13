/** Thrown when an Asana API call fails due to missing OAuth scopes on the token. */
export class AsanaInsufficientScopeError extends Error {
  readonly code = "insufficient_scope" as const;

  constructor(message: string) {
    super(message);
    this.name = "AsanaInsufficientScopeError";
  }
}

const INSUFFICIENT_SCOPE_RE =
  /one of the following scopes must be present|insufficient_scope|must be present to use this endpoint/i;

export function isAsanaInsufficientScopeMessage(message: string): boolean {
  return INSUFFICIENT_SCOPE_RE.test(message);
}

export function asanaInsufficientScopeError(message: string): AsanaInsufficientScopeError {
  return new AsanaInsufficientScopeError(message);
}

export function isAsanaInsufficientScopeError(
  err: unknown,
): err is AsanaInsufficientScopeError {
  if (err instanceof AsanaInsufficientScopeError) return true;
  if (err instanceof Error && isAsanaInsufficientScopeMessage(err.message)) {
    return true;
  }
  return false;
}

export const ASANA_RECONNECT_MESSAGE =
  "Reconnect Asana to grant additional permissions.";
