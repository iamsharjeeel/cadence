import { NextResponse } from "next/server";

export const API_VERSION_HEADERS = {
  "X-Cadence-API-Version": "1",
} as const;

export function apiJson<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: API_VERSION_HEADERS,
  });
}

export function apiUnauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized", code: "INVALID_API_KEY" },
    { status: 401, headers: API_VERSION_HEADERS },
  );
}

export function apiForbidden(): NextResponse {
  return NextResponse.json(
    { error: "Forbidden", code: "INSUFFICIENT_SCOPE" },
    { status: 403, headers: API_VERSION_HEADERS },
  );
}

export function apiValidationError(details: Record<string, string>): NextResponse {
  return NextResponse.json(
    {
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details,
    },
    { status: 400, headers: API_VERSION_HEADERS },
  );
}
