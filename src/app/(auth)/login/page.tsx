import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { discordConfig } from "@/lib/env";
import { safeRedirectPath } from "@/lib/http";
import { LoginForm } from "./login-form";
import { Container, Kicker } from "@/components/container";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inloggen | Modern Nerdplace",
};

const ERRORS: Record<string, string> = {
  discord_denied: "Je hebt het inloggen met Discord afgebroken.",
  discord_state: "Die inloglink is verlopen. Probeer het opnieuw.",
  discord_token: "Discord accepteerde de login niet. Probeer het opnieuw.",
  discord_profile: "Je Discord-profiel kon niet worden gelezen.",
  discord_failed: "Inloggen met Discord mislukte. Probeer het opnieuw.",
  invalid_code: "Die code is niet meer geldig. Vraag een nieuwe aan.",
  invalid_link: "Die link is niet compleet. Vraag een nieuwe code aan.",
  rate_limited: "Te veel pogingen. Wacht een paar minuten.",
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
  const error = params.error ? (ERRORS[params.error] ?? "Inloggen mislukte. Probeer het opnieuw.") : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Container className="max-w-md py-14 sm:py-20">
          <Kicker>$ sudo login</Kicker>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Inloggen</h1>
          <p className="mt-3 text-paper-muted">
            Nodig om je aan te melden voor een meetup of je profiel bij te werken. Kies wat het makkelijkst is.
          </p>

          {error ? (
            <p role="alert" className="mt-6 rounded-md border border-rocket/50 bg-rocket/10 px-4 py-3 text-sm">
              {error}
            </p>
          ) : null}

          <div className="mt-8 space-y-5">
            {discord ? (
              <a href={`/api/auth/discord?next=${encodeURIComponent(next)}`} className="btn w-full bg-[#5865F2] text-white hover:bg-[#4752c4]">
                Verder met Discord
              </a>
            ) : null}

            {discord ? (
              <div className="flex items-center gap-3 font-mono text-xs uppercase text-paper-faint">
                <span className="h-px flex-1 bg-ink-700" />
                of
                <span className="h-px flex-1 bg-ink-700" />
              </div>
            ) : null}

            <LoginForm next={next} />
          </div>

          <p className="mt-10 text-xs text-paper-faint">
            Een inlogcode werkt één keer en verloopt na 15 minuten. We bewaren je naam en e-mailadres, en wat je
            zelf op je profiel zet.
          </p>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
