# CampusHub Backend

REST API for reserving campus resources (rooms, equipment, labs) in time slots. It
lists resources, creates reservations while rejecting overlapping bookings, and
returns a user's active reservations. The API contract is in `docs/openapi.yaml`.

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
| GET | `/resources?type=` | List resources, optionally filtered by `type` |
| POST | `/reservations` | Create a reservation (`409` if the time slot overlaps) |
| GET | `/reservations/user/{userId}` | List a user's active (non-cancelled) reservations |

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

# Filter by type (200)
curl -i "http://localhost:3000/api/v1/resources?type=ROOM"

# Empty type (400 VALIDATION_ERROR)
curl -i "http://localhost:3000/api/v1/resources?type="

# Create a reservation (201); sending it again returns 409
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"<RESOURCE_ID>","userId":"user-456","startTime":"2026-10-01T10:00:00Z","endTime":"2026-10-01T11:00:00Z"}'

# A user's active reservations (200)
curl -i http://localhost:3000/api/v1/reservations/user/user-456
```

## Troubleshooting

**`ECONNREFUSED 127.0.0.1:27017`**: MongoDB isn't running, or isn't listening on
that address. Start `mongod` (see above) and check that `MONGODB_URI` points to it.
