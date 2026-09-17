export const site = {
  name: "Modern Nerdplace",
  tagline: "Meetups voor IT'ers uit Breda en omstreken",
  city: "Breda",
  discordUrl: "https://discord.gg/99HTc9JBca",
  meetupUrl: "https://www.meetup.com/modern-nerdplace/",
  // Nog in te vullen door Fabio: het adres waarop de community mail leest.
  email: "",
} as const;

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://modernnerdplace.nl").replace(
  /\/$/,
  "",
);

export function absoluteUrl(path: string) {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
