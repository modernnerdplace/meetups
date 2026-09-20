"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireMember } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { profileInputSchema, updateProfile } from "@/lib/profile";

export type ProfileState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  username?: string | null;
  profilePublic?: boolean;
};

function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

/** Het lid past alleen zijn eigen profiel aan: het id komt uit de sessie, nooit
 *  uit het formulier. */
export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  try {
    const member = await requireMember();
    const input = profileInputSchema.parse(formToObject(form));
    const saved = await updateProfile(member.id, input);
    revalidatePath("/account");
    revalidatePath("/nerds", "layout");
    return { ok: true, username: saved.username, profilePublic: saved.profilePublic };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[issue.path.join(".") || "_"] ??= issue.message;
      return { ok: false, error: "Kijk de gemarkeerde velden na.", fieldErrors };
    }
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("[account] save failed", error);
    return { ok: false, error: "Opslaan lukte niet. Probeer het opnieuw." };
  }
}
