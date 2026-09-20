import Image from "next/image";
import { clsx } from "clsx";

/** Foto als die er is, anders initialen op een kleur die bij de naam blijft. */
export function NerdAvatar({ name, src, size = 56, className }: { name: string; src: string | null; size?: number; className?: string }) {
  const classes = clsx("shrink-0 rounded-full border border-ink-600 object-cover", className);
  if (src) {
    return <Image src={src} alt="" width={size} height={size} className={classes} style={{ width: size, height: size }} unoptimized />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hues = ["bg-rocket/25", "bg-trace/25", "bg-spark/25", "bg-mint/25"];
  const hue = hues[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span
      aria-hidden
      className={clsx(classes, hue, "flex items-center justify-center font-display font-bold text-paper")}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </span>
  );
}
