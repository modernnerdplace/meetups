import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "error") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const unauthorized = (message = "Sign in first.") =>
  new HttpError(401, message, "unauthorized");
export const forbidden = (message = "Organisers only.") =>
  new HttpError(403, message, "forbidden");
export const notFound = (message = "Not found.") =>
  new HttpError(404, message, "not_found");
export const badRequest = (message: string, code = "bad_request") =>
  new HttpError(400, message, code);
export const conflict = (message: string, code = "conflict") =>
  new HttpError(409, message, code);
export const unavailable = (message: string, code = "not_configured") =>
  new HttpError(503, message, code);

export function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

/** Zet een fout om in een nette JSON-response. Onbekende fouten lekken niets. */
export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Check the fields and try again.",
        code: "invalid_input",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { error: "Something went wrong.", code: "internal_error" },
    { status: 500 },
  );
}

/** Alleen relatieve paden accepteren, anders kan ?next= naar een ander domein wijzen. */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest("Expected a JSON body.");
  }
}

/** Zelfde als readJson, maar een lege body is gewoon een leeg object. */
export async function readJsonOrEmpty(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Expected a JSON body.");
  }
}
