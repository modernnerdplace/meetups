/** Configuratie uit de omgeving. Ontbrekende waardes geven null terug, zodat een
 *  route netjes een 503 kan geven in plaats van te crashen. */

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw && raw.length > 0 ? raw : "http://localhost:3000").replace(/\/+$/, "");
}

export type DiscordConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function discordConfig(): DiscordConfig | null {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl()}/api/auth/discord/callback`,
  };
}

export type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
};

export function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10);
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS?.trim() || undefined;
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
    from: process.env.MAIL_FROM?.trim() || "Modern Nerdplace <hello@modernnerdplace.nl>",
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
