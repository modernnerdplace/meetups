import { formatMediumDate } from "@/app/(public)/_lib/format";
import { Container } from "@/components/container";
import { getCurrentMember, isAdmin } from "@/lib/auth";
import { PageHeader } from "../_components/page-header";
import { RoleSelect } from "../_components/role-select";
import { TerminalBadge } from "../_components/terminal-badge";
import { listMembers } from "../_lib/queries";

export const metadata = { title: "Leden" };

const roleLabel = { MEMBER: "member", ORGANISER: "organizer", ADMIN: "admin" } as const;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, me] = await Promise.all([searchParams, getCurrentMember()]);
  const admin = isAdmin(me);
  const members = await listMembers(q, { withEmail: admin });

  return (
    <>
      <PageHeader kicker={`${members.length}${members.length === 200 ? "+" : ""} nerds`} title="Leden">
        {admin
          ? "Als admin zie je e-mailadressen en kun je rollen aanpassen."
          : "Rollen en e-mailadressen zijn alleen voor admins."}
      </PageHeader>

      <Container className="mt-6">
        <form role="search" className="flex max-w-md gap-2">
          <label htmlFor="q" className="sr-only">
            Zoek leden
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder={admin ? "Naam, bedrijf of e-mail" : "Naam of bedrijf"}
            className="field"
          />
          <button type="submit" className="btn-ghost">
            Zoek
          </button>
        </form>

        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-ink-700">
              <tr className="kicker">
                <th scope="col" className="px-4 py-3 font-normal">
                  Naam
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Login
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Aangemeld
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Geweest
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Sinds
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Rol
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{member.name}</span>
                    {member.company ? <span className="block text-xs text-paper-faint">{member.company}</span> : null}
                    {member.email ? <span className="block font-mono text-xs text-paper-faint">{member.email}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.discordId ? <TerminalBadge tone="info">discord</TerminalBadge> : null}
                      {admin && member.email ? <TerminalBadge>e-mail</TerminalBadge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{member.registrations}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{member.attended}</td>
                  <td className="px-4 py-3 font-mono text-xs text-paper-faint">{formatMediumDate(member.createdAt)}</td>
                  <td className="px-4 py-3">
                    {admin ? (
                      <RoleSelect memberId={member.id} name={member.name} role={member.role} self={member.id === me?.id} />
                    ) : (
                      <TerminalBadge tone={member.role === "MEMBER" ? "neutral" : "ok"}>{roleLabel[member.role]}</TerminalBadge>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 font-mono text-sm text-paper-faint">
                    {q ? `$ grep "${q}": geen leden gevonden` : "Nog geen leden."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  );
}
