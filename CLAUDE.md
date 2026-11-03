# CampusHub — Project Rules

Master context for this repository. Every change must comply with the rules that apply
to its area:

- **Backend only** (`src/`): §1 Tech Stack, §2 Architecture.
- **Shared** (backend and `client/`): §3 Coding Standards (items marked *backend* excepted
  for `client/`), §4 Git, §5 Working Agreement.
- **Frontend only** (`client/`): §6. Backend restrictions on dependencies, source
  directories, and file extensions do not apply to `client/`.

If a request conflicts with these rules, stop and say so (see §5) — never silently work
around them.

---

## 1. Tech Stack & Authorized Libraries (backend)

**Authorized runtime dependencies — nothing else without explicit approval:**

| Purpose          | Package                   |
| ---------------- | ------------------------- |
| Language         | `typescript`              |
| HTTP framework   | `express`                 |
| ODM / database   | `mongoose`                |

**Authorized dev dependencies:** `@types/node`, `@types/express`, `ts-node`, `typescript`.

- **TypeScript only.** No `.js` or `.jsx` source files may be created or committed.
  All source lives under `src/` with the `.ts` extension. `dist/` is build output only
  and is never edited by hand.
- **No unauthorized libraries.** Do not add, import, or `npm install` any package not
  listed above — including "small helper" packages (lodash, moment, axios, dayjs, uuid,
  bcrypt, jsonwebtoken, dotenv, cors, helmet, etc.). If a task genuinely needs one,
  **stop and ask first**: state which package, why, and the alternative using only
  authorized packages.
- **No package swaps.** Do not replace Express with Fastify/Koa, or Mongoose with the
  raw MongoDB driver, Prisma, or any ORM.
- Prefer Node built-ins (`crypto`, `url`, `fs/promises`) over new dependencies.

---

## 2. Architectural Boundaries (backend)

Strict separation of concerns. Each layer calls only the layer directly beneath it
(exception: a service may also call other services).

```
Request → Routes (+ middleware) → Controllers → Services → Models → MongoDB
```

- **`src/routes/`** — path definitions and middleware mapping only; every handler
  delegates to a controller method. Forbidden: business logic, validation, database
  access, response shaping.
- **`src/middleware/`** — Express middleware mounted by routes or the app (e.g. auth,
  the central error handler). The only place besides controllers that may use `req`/`res`.
- **`src/controllers/`** — parse and validate the request (`req.body`, `req.params`,
  `req.query`), call exactly one service function, choose and send the success status
  and response body. Forbidden: database queries (`.find()`, `.save()`, `.aggregate()`,
  any query builder) and business rules (pricing, permissions logic, state transitions).
- **`src/services/`** — all domain rules, orchestration, and data access through models.
  Framework-agnostic: never touch `req`, `res`, `next`, or HTTP status codes. Throw
  typed domain errors.
- **`src/models/`** — Mongoose schemas, their TypeScript interfaces, and model exports.
  Schema-local validators, indexes, and virtuals allowed. Forbidden: business logic,
  cross-collection orchestration, HTTP concerns.

```ts
// src/routes/event.routes.ts
import { Router } from 'express';
import { createEvent } from '../controllers/event.controller';
import { requireAuth } from '../middleware/requireAuth';

const router: Router = Router();
router.post('/events', requireAuth, createEvent);
export default router;
```

### Layer violation checklist (verify before finishing any change)

- [ ] No model import inside `src/controllers/` — only `import type` of model
      interfaces is allowed.
- [ ] No `express` import inside `src/services/` or `src/models/`.
- [ ] No `res.` / `req.` usage outside `src/controllers/` and `src/middleware/`.
- [ ] No logic inside `src/routes/` beyond path + middleware + controller reference.

---

## 3. Coding Standards & Safety (shared)

### Typing

- **`any` is banned** — including `any[]`, `Promise<any>`, `as any`, `catch (e: any)`,
  and implicit `any` from untyped parameters. Use a concrete interface, or `unknown`
  plus a narrowing type guard when the shape is genuinely not known.
- **Every function has an explicit signature** — all parameters typed and an explicit
  return type (`Promise<T>` for async). Never rely on inference.
- *Backend:* **every DB schema has a matching interface**, built as
  `new Schema<IThing>(...)` so the two stay in sync.
- `tsconfig.json` runs in `strict` mode. Do not weaken compiler options (`strict`,
  `noImplicitAny`, `strictNullChecks`) to make code compile.
- No `@ts-ignore` / `@ts-expect-error` — fix the type.

```ts
// src/models/event.model.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  hostId: Types.ObjectId;
  startsAt: Date;
  capacity: number;
}

const eventSchema = new Schema<IEvent>({
  title:    { type: String, required: true, trim: true },
  hostId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startsAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1 },
}, { timestamps: true });

export const Event = model<IEvent>('Event', eventSchema);
```

### Async error handling

- **No unhandled promises.** Every promise is `await`ed, returned, or handled with
  `.catch()`. No floating async calls.
- Never swallow errors with `catch {}`. Catch blocks type the error as `unknown` and
  narrow it before use.
- *Backend error flow:* services throw typed domain errors → controllers forward them
  with `next(err)` (every controller `await` sits in `try/catch`, or the handler is
  wrapped in a shared `asyncHandler`) → a single centralized error-handling middleware
  maps errors to HTTP status codes and owns the error response shape.

```ts
// src/controllers/event.controller.ts
import { Request, Response, NextFunction } from 'express';
import { createEventForHost, IEventInput } from '../services/event.service';
import { ValidationError } from '../errors';
import type { IEvent } from '../models/event.model';

const isEventInput = (body: unknown): body is IEventInput => {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.title === 'string'
    && typeof b.startsAt === 'string'
    && typeof b.capacity === 'number';
};

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body: unknown = req.body;
    if (!isEventInput(body)) {
      throw new ValidationError('Invalid event payload');
    }
    const event: IEvent = await createEventForHost(body);
    res.status(201).json(event);
  } catch (err: unknown) {
    next(err);
  }
};
```

### General

- `const` by default; `let` only when reassigned; `var` is forbidden.
- Named exports for functions; keep files focused on one responsibility.
- No `console.log` in committed code paths — use the project logger or nothing.
- *Backend:* no secrets, connection strings, or API keys in source. Read from
  `process.env`, validated once at startup into a typed config object.

---

## 4. Git & Commit Formatting (shared)

When reporting completed work (commit messages, PR descriptions, or a diff summary in
chat), keep it **concise** and always cover:

1. **What was built** — the change in one or two sentences, plus files/layers touched.
2. **Why the context rules were applied** — which CLAUDE.md rules shaped the design
   (e.g. "query moved into the service layer because controllers may not touch
   Mongoose"; "introduced `IEventInput` instead of `any` for the request body").

```
<type>(<scope>): <short imperative summary>

What: <what was built, 1–2 sentences>
Why:  <rule(s) from CLAUDE.md that shaped the implementation>
```

- Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.
- Summary line under 72 characters.
- One logical change per commit; do not mix refactors with features.
- Do not commit `node_modules/`, `dist/`, `.env`, or editor files.
- Do not commit or push unless explicitly asked.

---

## 5. Working Agreement (shared)

- Do exactly what is asked — do not scaffold extra files, add packages, or "improve"
  unrelated code alongside a requested change.
- If a request cannot be satisfied within these rules, stop, say so, and propose the
  compliant alternative instead of bending a rule.

---

## 6. Frontend Guidelines (`client/`)

Applies to the React + TypeScript app under `client/`, together with the shared rules
in §3–§5.

### Component Architecture

- **Functional components only.** No class components.
- **Every component declares an explicit props interface** named `<Component>Props`,
  types its parameter with it, and has an explicit return type.

```tsx
// client/src/components/EventCard.tsx
interface EventCardProps {
  title: string;
  startsAt: Date;
  capacity: number;
}

export function EventCard({ title, startsAt, capacity }: EventCardProps): JSX.Element {
  return (
    <article>
      <h3>{title}</h3>
      <p>{startsAt.toLocaleString()} · {capacity} spots</p>
    </article>
  );
}
```

### State Management

- Use standard React hooks (`useState`, `useEffect`) or custom hooks (`useXxx`) for
  state and side effects.
- **No inline API calls inside JSX.** Data fetching belongs in a `useEffect` or a custom
  hook, never in event-handler attributes or render expressions directly.
- Extract reusable fetching/state logic into custom hooks so components stay focused on
  rendering.

### Styling

- Keep styling modular and consistent: CSS Modules (`Component.module.css`) or standard
  utility classes.
- Avoid ad-hoc inline `style={{ ... }}` objects beyond one-off dynamic values.
