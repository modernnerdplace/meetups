"use client";

import type { MemberRole } from "@prisma/client";
import { useState, useTransition } from "react";

import { setMemberRoleAction } from "../actions";

const labels: Record<MemberRole, string> = {
  MEMBER: "member",
  ORGANISER: "organizer",
  ADMIN: "admin",
};

export function RoleSelect({
  memberId,
  name,
  role,
  self,
}: {
  memberId: string;
  name: string;
  role: MemberRole;
  self: boolean;
}) {
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: MemberRole) {
    if (next === value) return;
    const warning = self
      ? "Je past je eigen rol aan. Zonder adminrol kun je dit niet terugdraaien. Doorgaan?"
      : `Rol van ${name} wijzigen naar ${labels[next]}?`;
    if (!window.confirm(warning)) return;
    const previous = value;
    setValue(next);
    setError(null);
    const form = new FormData();
    form.set("memberId", memberId);
    form.set("role", next);
    startTransition(async () => {
      const result = await setMemberRoleAction(form);
      if (!result.ok) {
        setValue(previous);
        setError(result.error ?? "Dat lukte niet.");
      }
    });
  }

  return (
    <div>
      <label htmlFor={`role-${memberId}`} className="sr-only">
        Rol van {name}
      </label>
      <select
        id={`role-${memberId}`}
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value as MemberRole)}
        className="field w-auto py-1.5 font-mono text-xs"
      >
        {(Object.keys(labels) as MemberRole[]).map((key) => (
          <option key={key} value={key}>
            {labels[key]}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rocket-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
