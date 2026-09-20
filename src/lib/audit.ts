import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof prisma;

export type AuditEntry = {
  actorId: string | null;
  /** Bijvoorbeeld "event.create", "rsvp.cancel", "member.role". */
  action: string;
  entityType: "event" | "rsvp" | "member";
  entityId?: string | null;
  summary: string;
  /** Alleen ids en gewijzigde velden. Nooit e-mailadressen of opmerkingen. */
  data?: Prisma.InputJsonValue;
};

/** Schrijft een regel in de auditlog. Geef de transactie mee als die er is, dan
 *  staat de regel er alleen als de wijziging zelf ook gelukt is. */
export async function recordAudit(client: Client, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      data: entry.data,
    },
  });
}
