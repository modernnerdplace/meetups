/**
 * Profielen tegen de lokale database: validatie, privé blijft privé, en publieke
 * queries lekken geen e-mail of notities.
 *
 *   npx tsx src/lib/__checks__/profile.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // DATABASE_URL moet dan al gezet zijn.
  }
}

const run = randomBytes(4).toString("hex");
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
};

async function main() {
  const { prisma } = await import("../db");
  const profile = await import("../profile");
  const email = (n: string) => `check-${run}-${n}@example.invalid`;
  try {
    const bad = profile.profileInputSchema.safeParse({
      name: "X",
      username: "-Bad Name-",
      linkedinUrl: "https://evil.example.com/in/x",
      githubUrl: "http://github.com/x",
      interests: Array.from({ length: 13 }, (_, i) => `t${i}`).join(","),
    });
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
    for (const f of ["name", "username", "linkedinUrl", "githubUrl", "interests"]) {
      check(`rejects ${f}`, paths.includes(f), JSON.stringify(paths));
    }
    check("reserved username", !profile.profileInputSchema.safeParse({ name: "Ab", username: "admin" }).success);
    const good = profile.profileInputSchema.parse({ name: "Ada", interests: " Intune ,Intune, Zero  Trust ,", isMvp: "on" });
    check("interests deduped and trimmed", JSON.stringify(good.interests) === '["Intune","Zero Trust"]', JSON.stringify(good.interests));
    check("checkbox on is true, missing is false", good.isMvp && !good.isMct);

    const a = await prisma.member.create({ data: { name: `Ada ${run}`, email: email("a"), notes: "secret note" } });
    const b = await prisma.member.create({ data: { name: `Bob ${run}`, email: email("b") } });

    let refused = false;
    try {
      await profile.updateProfile(a.id, profile.profileInputSchema.parse({ name: "Ada", profilePublic: "on" }));
    } catch {
      refused = true;
    }
    check("public without username is refused", refused);

    await profile.updateProfile(a.id, profile.profileInputSchema.parse({ name: `Ada ${run}`, username: `ada-${run}`, profilePublic: "on", interests: "Intune" }));
    const saved = await prisma.member.findUniqueOrThrow({ where: { id: a.id } });
    check("consent moment stored", saved.profilePublicAt !== null);

    let taken = false;
    try {
      await profile.updateProfile(b.id, profile.profileInputSchema.parse({ name: "Bob", username: `ada-${run}` }));
    } catch (error) {
      taken = error instanceof Error && error.message.includes("bezet");
    }
    check("duplicate username is refused", taken);

    const pub = await profile.getPublicProfile(`ada-${run}`);
    const json = JSON.stringify(pub);
    check("public profile found", pub !== null);
    check("no email in public profile", !json.includes("example.invalid"));
    check("no notes in public profile", !json.includes("secret note"));
    const list = await profile.listPublicProfiles({ interest: "Intune" });
    check("listed under interest", list.some((m) => m.username === `ada-${run}`));
    check("no email in list", !JSON.stringify(list).includes("example.invalid"));

    await profile.updateProfile(a.id, profile.profileInputSchema.parse({ name: `Ada ${run}`, username: `ada-${run}` }));
    check("private again means gone", (await profile.getPublicProfile(`ada-${run}`)) === null);
    check("consent moment cleared", (await prisma.member.findUniqueOrThrow({ where: { id: a.id } })).profilePublicAt === null);
  } catch (error) {
    failures += 1;
    console.error("check crashed", error);
  } finally {
    await prisma.member.deleteMany({ where: { email: { startsWith: `check-${run}-` } } });
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
