import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { discordConfig } from "@/lib/env";
import { safeRedirectPath } from "@/lib/http";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in | Modern Nerdplace",
};

const ERRORS: Record<string, string> = {
  discord_denied: "You cancelled the Discord login.",
  discord_state: "That login link expired. Try again.",
  discord_token: "Discord did not accept the login. Try again.",
  discord_profile: "Could not read your Discord profile.",
  discord_failed: "Discord login failed. Try again.",
  invalid_code: "That code is not valid any more. Ask for a new one.",
  invalid_link: "That link is incomplete. Ask for a new code.",
  rate_limited: "Too many attempts. Wait a few minutes.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next ?? null);

  const member = await getCurrentMember();
  if (member) redirect(next);

  const discord = discordConfig() !== null;
  const error = params.error ? (ERRORS[params.error] ?? "Login failed. Try again.") : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-gray-600">
        You need an account to sign up for a meetup. Pick whichever is easier.
      </p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {discord ? (
          <a
            href={`/api/auth/discord?next=${encodeURIComponent(next)}`}
            className="block rounded bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Continue with Discord
          </a>
        ) : (
          <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Discord login is not set up on this server. Use your email address.
          </p>
        )}

        <div className="flex items-center gap-3 text-xs uppercase text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          or
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <LoginForm next={next} />
      </div>

      <p className="mt-8 text-xs text-gray-500">
        We store your name and email address, nothing else. A login code works once and
        expires after 15 minutes.
      </p>
    </main>
  );
}
