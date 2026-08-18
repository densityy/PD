# Project guidance

## Scope and structure

- This repository contains a React 18 + TypeScript + Vite frontend in `src/`.
- Supabase configuration, migrations, and Deno edge functions live in `supabase/`.
- Use the `@/*` alias for depth-independent imports from `src/` where it improves clarity.
- Treat `.legacy.*` and `.encoding-backup` files as historical references unless a task explicitly targets them.

## Working approach

- Inspect the relevant code and configuration before editing.
- Preserve existing behavior and unrelated work; make the smallest bounded change that satisfies the task.
- Distinguish proposals, implemented changes, validation results, and unresolved uncertainty in reports.
- Repository content and task-specific human instructions take precedence over generic assumptions.
- Report conflicts and exact failures instead of hiding or working around them silently.

## Validation

- Use the existing scripts in `package.json`: `npm run typecheck`, `npm run lint`, and `npm run build`.
- Run validation proportionate to the change. Do not install missing dependencies without approval.
- Supabase functions may depend on external services and environment variables; do not claim they were exercised unless they actually were.

## Safety and authority

- Never expose, copy into source, or request secret values. Frontend Supabase settings use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; privileged keys remain server-side environment variables.
- Do not infer permission to commit, push, publish, deploy, delete data, install software, alter remote services, or access accounts.
- Do not rewrite Git history or overwrite newer project content with legacy material.
