# Seceurope Web

Seceurope Web is a Next.js access-control portal for gate operations. It provides a manager dashboard, a tablet guard view, ABIOT scan ingest endpoints, and a Supabase-backed event pipeline for RFID vehicle checks.

## Features

- `/manager` for the control-room workflow
- `/tablet` for the guard-facing workflow
- ABIOT-compatible ingest endpoint at `/api/abiot/ingest`
- Supabase-backed event conversion and resolution flow
- Custom Node server with WebSocket live updates on `/ws`

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Node custom server (`server.mjs`)
- Supabase (`@supabase/supabase-js`)
- Vitest

## Getting Started

Prerequisites:

- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Build and run production:

```bash
npm run build
npm run start
```

Run tests:

```bash
npm run test
```

On Windows, `scripts/start-dev.cmd` is a small helper that starts the app from the repo root with a normal `npm run dev`.

## Environment

Copy [`.env.example`](./.env.example) to `.env.local` and fill in the values you need.

Required for Supabase mode:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Raw table and mapping configuration:

- `RAW_SCAN_TABLE`
- `ACCESS_EVENTS_TABLE`
- `EVENT_RESOLUTIONS_TABLE`
- `MAP_EPC`
- `MAP_TID`
- `MAP_READER_ID`
- `MAP_TS`
- `MAP_GATE_ID`
- `MAP_DIRECTION`
- `MAP_PLATE` (optional)

Optional integration settings:

- `CONVERT_BATCH_SIZE`
- `EVENT_FETCH_LIMIT`
- `CONVERT_INTERNAL_TOKEN`
- `ABIOT_API_BASE_URL`
- `ABIOT_LOOKUP_URL`
- `ABIOT_UPDATE_URL`
- `ABIOT_MAIL_URL`
- `ABIOT_UPDATE_TOKEN`
- `ABIOT_MAIL_KEYID`

If the Supabase server credentials are missing, the app falls back to deterministic in-memory demo behavior for local development.

## Database

The reference schema is in [supabase/schema.sql](./supabase/schema.sql).

Typical setup:

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Add the matching environment variables to `.env.local` or your host.

## API Summary

- `GET /api/events?surface=manager|tablet&gateId=...`
- `GET /api/abiot/ingest?uhf_epc_hex=...&uhf_tid=...&reader_id=...&mode=handheld|antenna&gate_id=...&direction=entry|exit`
- `POST /api/events/{eventKey}/resolve`
- `POST /api/convert/run`
- `POST /api/scans`
- `POST /api/abiot/register`
- `POST /api/fetch-latest`

## Deployment Notes

This project uses a custom Node server and WebSockets. Deploy it to a host that supports a long-running Node process. It is not a drop-in Vercel deployment as-is.

## Repository Notes

This repo is prepared to be pushed as a standalone website project. Local-only files such as `.env.local`, `.next`, `node_modules`, `.data`, `.logs`, editor settings, and assistant helper files are excluded through `.gitignore`.
