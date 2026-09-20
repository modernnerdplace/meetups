import { MemberRole } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/http";

/** Rol van een lid wijzigen. De aanroeper moet admin zijn; hier bewaken we alleen
 *  dat er altijd minstens een admin overblijft. */
export async function setMemberRole(memberId: string, role: MemberRole, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: memberId } });
    if (!member) throw notFound("Dat lid bestaat niet.");
    if (member.role === role) return member;

    if (member.role === MemberRole.ADMIN) {
      const admins = await tx.member.count({ where: { role: MemberRole.ADMIN } });
      if (admins <= 1) throw badRequest("Er moet minstens een admin overblijven.", "last_admin");
    }

    const updated = await tx.member.update({ where: { id: memberId }, data: { role } });
    await recordAudit(tx, {
      actorId,
      action: "member.role",
      entityType: "member",
      entityId: member.id,
      summary: `Rol van ${member.name} gewijzigd van ${member.role.toLowerCase()} naar ${role.toLowerCase()}`,
      data: { from: member.role, to: role },
    });
    return updated;
  });
}
