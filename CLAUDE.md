# CampusHub Backend — Project Context & Coding Rules

This file is the master context for this repository. Every change made in this repo
must comply with the rules below. When a request conflicts with these rules, stop and
say so instead of silently working around them.

---

## 1. Tech Stack & Authorized Libraries

**Authorized runtime dependencies — nothing else without explicit approval:**

| Purpose          | Package                   |
| ---------------- | ------------------------- |
| Language         | `typescript`              |
| HTTP framework   | `express`                 |
| ODM / database   | `mongoose`                |

**Authorized dev dependencies:** `@types/node`, `@types/express`, `ts-node`, `typescript`.

### Hard rules

- **TypeScript only.** No `.js` or `.jsx` source files may be created or committed.
  All source lives under `src/` with the `.ts` extension. Compiled output (`dist/`)
  is build artifact only and is never edited by hand.
- **No unauthorized libraries.** Do not add, import, or `npm install` any package not
  listed above. This includes "small helper" packages (lodash, moment, axios, dayjs,
  uuid, bcrypt, jsonwebtoken, dotenv, cors, helmet, etc.). If a task genuinely needs
  a new dependency, **stop and ask first** — state which package, why, and what the
  alternative would be using only authorized packages.
- **No package swaps.** Do not replace Express with Fastify/Koa, or Mongoose with the
  raw MongoDB driver, Prisma, or any ORM.
- Prefer Node's built-in modules (`crypto`, `url`, `fs/promises`) over new dependencies.

---

## 2. Architectural Boundaries

Strict separation of concerns. Each layer may only call the layer directly beneath it.

```
Request → Routes → Controllers → Services → Models → MongoDB
```

### `src/routes/` — Routing only

- Route path definitions and middleware mapping **only**.
- Each route handler must delegate to a controller method. No inline handler logic.
- **Forbidden:** business logic, validation logic, database access, response shaping.

```ts
// src/routes/event.routes.ts
import { Router } from 'express';
import { createEvent } from '../controllers/event.controller';
import { requireAuth } from '../middleware/requireAuth';

const router: Router = Router();
router.post('/events', requireAuth, createEvent);
export default router;
```

### `src/controllers/` — Request/response handling only

- Parse and validate the incoming request (`req.body`, `req.params`, `req.query`).
- Call exactly one service function to do the work.
- Choose and send the HTTP status code and response body.
- **Forbidden:** any direct database query. A controller must never import a Mongoose
  model or call `.find()`, `.save()`, `.aggregate()`, or any query builder.
- **Forbidden:** business rules (pricing, permissions logic, state transitions).

### `src/services/` — Pure business logic

- All domain rules, orchestration, and data access through models live here.
- Services are framework-agnostic: **never import `express`**, and never touch
  `req`, `res`, `next`, or HTTP status codes.
- Services throw typed domain errors; controllers translate them into status codes.
- A service may call other services and may call models.

### `src/models/` — Schemas and interfaces only

- Mongoose schemas, their TypeScript interfaces, and model exports.
- Schema-local validators, indexes, and virtuals are allowed.
- **Forbidden:** business logic, cross-collection orchestration, HTTP concerns.

### Layer violation checklist (verify before finishing any change)

- [ ] No model import inside `src/controllers/`.
- [ ] No `express` import inside `src/services/` or `src/models/`.
- [ ] No `res.` / `req.` usage outside `src/controllers/` and `src/middleware/`.
- [ ] No logic inside `src/routes/` beyond path + middleware + controller reference.

---

## 3. Coding Standards & Safety

### Typing

- **`any` is banned.** This includes `any[]`, `Promise<any>`, `as any`, and implicit
  `any` from untyped parameters. Use a concrete interface; use `unknown` plus a
  narrowing type guard when the shape is genuinely not known.
- **Every function has an explicit signature** — all parameters typed and an explicit
  return type, including `Promise<T>` for async functions. No relying on inference
  for exported functions.
- **Every DB schema has a matching interface.** Declare the interface, then build the
  schema as `new Schema<IThing>(...)` so the two stay in sync.
- `tsconfig.json` runs in `strict` mode. Do not weaken compiler options
  (`strict`, `noImplicitAny`, `strictNullChecks`) to make code compile.
- No `@ts-ignore` / `@ts-expect-error` to silence a type error — fix the type.

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

- **No unhandled promises.** Every promise is `await`ed, returned, or explicitly
  handled with `.catch()`. No floating async calls.
- Every `await` in a controller sits inside `try/catch`, or the handler is wrapped in
  a shared `asyncHandler` utility that forwards rejections to `next(err)`.
- Never use `catch {}` to swallow an error silently.
- Catch blocks type the error as `unknown` and narrow it before use — never `catch (e: any)`.
- All errors end at a single Express error-handling middleware that owns the final
  status code and response shape.

```ts
// src/controllers/event.controller.ts
import { Request, Response, NextFunction } from 'express';
import { createEventForHost } from '../services/event.service';
import { IEvent } from '../models/event.model';

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const event: IEvent = await createEventForHost(req.body);
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
- No secrets, connection strings, or API keys in source. Read from `process.env`,
  validated once at startup into a typed config object.

---

## 4. Git & Commit Formatting

When reporting completed work (commit messages, PR descriptions, or a diff summary
in chat), keep it **concise** and always cover two things:

1. **What was built** — the change in one or two sentences, plus the files/layers touched.
2. **Why the context rules were applied** — which CLAUDE.md rules shaped the design
   (e.g. "query moved into the service layer because controllers may not touch
   Mongoose"; "introduced `IEventInput` instead of `any` for the request body").

Format:

```
<type>(<scope>): <short imperative summary>

What: <what was built, 1–2 sentences>
Why:  <rule(s) from CLAUDE.md that shaped the implementation>
```

- Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`.
- Keep the summary line under 72 characters.
- One logical change per commit; do not mix refactors with features.
- Do not commit `node_modules/`, `dist/`, `.env`, or editor files.
- Do not commit or push unless explicitly asked.

---

## 5. Working Agreement

- Do exactly what is asked — do not scaffold extra files, add packages, or "improve"
  unrelated code alongside a requested change.
- If a request cannot be satisfied within these rules, say so and propose the
  compliant alternative instead of bending a rule.
