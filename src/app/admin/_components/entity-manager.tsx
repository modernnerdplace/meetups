"use client";

import { clsx } from "clsx";
import { startTransition, useActionState, useEffect, useState, useTransition } from "react";

import type { ActionState } from "../actions";

export type EntityField = {
  name: string;
  label: string;
  type?: "text" | "url" | "textarea" | "select";
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type EntityItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  /** Waarden voor het formulier, per veldnaam. */
  values: Record<string, string>;
  /** Waarom dit item niet weg mag; leeg betekent dat het wel mag. */
  lockedReason?: string | null;
};

type SaveAction = (state: ActionState, form: FormData) => Promise<ActionState>;

/** Lijst met een formulier eronder, voor de eenvoudige dingen: sprekers,
 *  locaties en sponsors. De server actions komen als prop binnen. */
export function EntityManager({
  items,
  fields,
  idField,
  saveAction,
  deleteAction,
  addLabel,
  emptyLabel,
  canDelete,
}: {
  items: EntityItem[];
  fields: EntityField[];
  idField: string;
  saveAction: SaveAction;
  deleteAction: (id: string) => Promise<ActionState>;
  addLabel: string;
  emptyLabel: string;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [pending, startRowTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  function remove(item: EntityItem) {
    if (!window.confirm(`${item.title} verwijderen?`)) return;
    setRowError(null);
    startRowTransition(async () => {
      const result = await deleteAction(item.id);
      if (!result.ok) setRowError(result.error ?? "Dat lukte niet.");
    });
  }

  return (
    <div>
      {rowError ? (
        <p role="alert" className="mb-3 text-sm text-rocket-300">
          {rowError}
        </p>
      ) : null}

      {items.length === 0 && open !== "new" ? (
        <p className="font-mono text-sm text-paper-faint">$ ls: {emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-ink-700">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              {open === item.id ? (
                <EntityForm
                  fields={fields}
                  idField={idField}
                  id={item.id}
                  values={item.values}
                  saveAction={saveAction}
                  onDone={() => setOpen(null)}
                />
              ) : (
                <div className={clsx("flex flex-wrap items-start justify-between gap-3", pending && "opacity-70")}>
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    {item.subtitle ? <p className="text-sm text-paper-muted">{item.subtitle}</p> : null}
                    {item.meta ? <p className="mt-0.5 font-mono text-xs text-paper-faint">{item.meta}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpen(item.id)}>
                      Wijzig
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="btn px-3 py-1.5 text-xs text-paper-muted hover:text-rocket-300 disabled:opacity-40"
                        disabled={pending || Boolean(item.lockedReason)}
                        title={item.lockedReason ?? undefined}
                        onClick={() => remove(item)}
                      >
                        Weg
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {open === "new" ? (
          <EntityForm
            fields={fields}
            idField={idField}
            id=""
            values={{}}
            saveAction={saveAction}
            onDone={() => setOpen(null)}
          />
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setOpen("new")}>
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function EntityForm({
  fields,
  idField,
  id,
  values,
  saveAction,
  onDone,
}: {
  fields: EntityField[];
  idField: string;
  id: string;
  values: Record<string, string>;
  saveAction: SaveAction;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAction, { ok: false });
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="panel space-y-4 p-4 sm:p-5"
      noValidate
    >
      {id ? <input type="hidden" name={idField} value={id} /> : null}

      {state.error ? (
        <p role="alert" className="rounded-md border border-rocket/50 bg-rocket/10 px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const error = errors[field.name];
          const full = field.type === "textarea";
          return (
            <div key={field.name} className={full ? "sm:col-span-2" : undefined}>
              <label htmlFor={`f-${field.name}`} className="block text-sm font-medium">
                {field.label}
              </label>
              <div className="mt-1.5">
                {field.type === "textarea" ? (
                  <textarea
                    id={`f-${field.name}`}
                    name={field.name}
                    rows={4}
                    defaultValue={values[field.name] ?? ""}
                    className={clsx("field", error && "border-rocket")}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={`f-${field.name}`}
                    name={field.name}
                    defaultValue={values[field.name] ?? ""}
                    className={clsx("field", error && "border-rocket")}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`f-${field.name}`}
                    name={field.name}
                    type={field.type === "url" ? "url" : "text"}
                    required={field.required}
                    defaultValue={values[field.name] ?? ""}
                    className={clsx("field", error && "border-rocket")}
                  />
                )}
              </div>
              {error ? (
                <p className="mt-1 text-sm text-rocket-300">{error}</p>
              ) : field.hint ? (
                <p className="mt-1 text-xs text-paper-faint">{field.hint}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Bezig..." : "Opslaan"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone} disabled={pending}>
          Annuleren
        </button>
      </div>
    </form>
  );
}
