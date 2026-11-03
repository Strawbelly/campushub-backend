# CampusHub Backend

REST API for reserving campus resources (rooms, equipment, labs) in time slots. It
lists resources, creates reservations while rejecting overlapping bookings,
returns all of a user's reservations, and confirms or cancels reservations. The API contract is in `docs/openapi.yaml`.

## Tech Stack

- TypeScript (run with `ts-node`)
- Node.js + Express 5
- MongoDB + Mongoose 9

## Architecture

```
Request → Routes → Controllers → Services → Models → MongoDB
```

| Layer | Folder | Responsibility |
| --- | --- | --- |
| Routes | `src/routes/` | Map paths to controller methods |
| Controllers | `src/controllers/` | Read `req`, call a service, send the status code and JSON |
| Services | `src/services/` | Validation, business rules, all database access |
| Models | `src/models/` | Mongoose schemas for `Resource` and `Reservation` |

Supporting code: `src/config/` (env config and DB connection),
`src/middleware/errorHandler.ts` (JSON 500 responses), `src/types/` (API types).

## Setup & Running

**Prerequisites:** Node.js, npm, and MongoDB (`mongod`) installed locally.

```bash
npm install
```

Start MongoDB:

```bash
mkdir -p ~/data/db
mongod --dbpath ~/data/db
```

In another terminal, start the API:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/campushub npm run dev
```

The server listens on port `3000` (override with `PORT`). `MONGODB_URI` is required;
see `.env-example`. The project does not load `.env` automatically, so pass the
variables on the command line as shown.

## API Endpoints

Base path: `/api/v1`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/resources?type=&isAvailable=` | List resources, optionally filtered by `type` (`ROOM`, `EQUIPMENT`, `LAB`) and `isAvailable` (`true`/`false`) |
| POST | `/reservations` | Create a reservation (`409` if the time slot overlaps) |
| GET | `/reservations/user/{userId}` | List all of a user's reservations, including cancelled ones |
| PATCH | `/reservations/{id}/confirm` | `PENDING` → `CONFIRMED` (`409` from any other status) |
| PATCH | `/reservations/{id}/cancel` | `PENDING`/`CONFIRMED` → `CANCELLED`, freeing the time slot (`409` if already cancelled) |

## Testing

The local database starts empty, and the API has no endpoint for creating
resources. Insert at least one resource before testing reservations, e.g. with
`mongosh` or MongoDB Compass:

```js
// database: campushub
db.resources.insertOne({ name: "Study Room 101", type: "ROOM", location: "Snell Library", isAvailable: true })
```

Use the inserted document's `_id` as `<RESOURCE_ID>` below.

```bash
# List resources (200)
curl -i http://localhost:3000/api/v1/resources

# Filter by type and availability (200)
curl -i "http://localhost:3000/api/v1/resources?type=ROOM&isAvailable=true"

# Empty type (400 VALIDATION_ERROR)
curl -i "http://localhost:3000/api/v1/resources?type="

# Create a reservation (201); sending it again returns 409
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"<RESOURCE_ID>","userId":"user-456","startTime":"2026-11-10T10:00:00Z","endTime":"2026-11-10T11:00:00Z"}'

# All of a user's reservations (200)
curl -i http://localhost:3000/api/v1/reservations/user/user-456

# Confirm, then cancel, using the reservation's id (200); cancelling frees the slot
curl -i -X PATCH http://localhost:3000/api/v1/reservations/<RESERVATION_ID>/confirm
curl -i -X PATCH http://localhost:3000/api/v1/reservations/<RESERVATION_ID>/cancel
```

## Troubleshooting

**`ECONNREFUSED 127.0.0.1:27017`**: MongoDB isn't running, or isn't listening on
that address. Start `mongod` (see above) and check that `MONGODB_URI` points to it.

## Lab 6 – Codebase Refactoring & Context Optimization

This lab covers both the Express backend (`src/`) and the React frontend (`client/`).

### Context Optimization

| Artifact | Description |
| --- | --- |
| `CLAUDE.md` | Updated project instructions: which rules apply to the backend (`src/`), the frontend (`client/`), or both. |
| `.claude/settings.json` | Claude Code permission rules that deny reads of dependencies, build output, lockfiles, logs, source maps and `.env` files. This is Claude Code's equivalent of an agent ignore file. |

### Refactored Codebase

| Artifact | Description |
| --- | --- |
| `src/middleware/errorHandler.ts` | Central backend error handling, split between two middleware files. `src/middleware/asyncHandler.ts` wraps each controller and forwards any rejected controller promise to `errorHandler.ts`, so controllers contain no try/catch. `errorHandler.ts` maps each error to an HTTP response with a `{ code, message }` body: validation `400`, not found `404`, conflict `409`, malformed JSON `400`, and any unexpected error `500`. |
| `client/src/hooks/useReservations.ts` | Reusable React hooks: `useBooking` (create a reservation) and `useUserReservations` (load and cancel a user's reservations). They were extracted from `BookingForm.tsx` and `UserReservations.tsx`, which now only render. |
| `src/types/reservation.ts` | Shared TypeScript API types used by both backend and frontend: `IResource`, `IReservation`, `IErrorResponse`, `ICreateReservationRequest`, `RESOURCE_TYPES`, `RESERVATION_STATUSES`. `client/src/api/campushubApi.ts` re-exports them under the client's existing names. The file has no imports, so the frontend never pulls in backend dependencies. `client/vite.config.ts` (`server.fs.allow`) lets the Vite dev server serve it. |

### Verification

- Passed: backend type check (`src/`), client `tsc -b`, client lint, client
  production build, and the Vite dev server serving the shared types file.
- Manual backend smoke tests:
  - `400` returned for validation errors and for malformed JSON.
  - `500` returned when the database was unavailable.
- Reviewed in code only: the `404` and `409` mappings were not runtime-tested.
- Not covered: the project has no automated tests, and the full browser flow
  (which needs a running MongoDB) was not exercised.
