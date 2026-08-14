# Seceurope Web

Seceurope Web is a Next.js access-control portal designed for gate operations. It provides a real-time manager dashboard, a tablet view for security guards, ABIOT scan ingest endpoints, and a Supabase-backed event pipeline for RFID vehicle checks.

## Features

- `/manager`: A real-time control-room dashboard for monitoring access events.
- `/tablet`: A simplified, guard-facing workflow for verifying vehicle entry and exits at the gate.
- **ABIOT-compatible ingest endpoint:** Receives RFID scan data at `/api/abiot/ingest`.
- **Supabase-backed event pipeline:** Handles event conversion, storage, and resolution tracking.
- **Real-time Updates:** A custom Node server (`server.mjs`) pushes live updates over WebSockets (`/ws`) to the dashboards whenever a new scan is detected.
- **Keep-Alive Scripts:** Internal background processes that prevent Render free tier web services and Supabase free tier instances from sleeping due to inactivity.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Node custom server (`server.mjs`)
- Supabase (`@supabase/supabase-js`)
- WebSockets (`ws`)
- Vitest

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

1. Install all dependencies:
   ```text
   npm i
   ```

2. Create a local environment file from the template:
   ```text
   cp .env.example .env.local
   ```

3. Start the development server:
   ```text
   npx cross-env NODE_ENV=development node server.mjs
   ```

### Production Build

Build and run for production:

```text
npx next build
npx cross-env NODE_ENV=production node server.mjs
```

### Tests

Run Vitest unit tests:

```text
npx vitest run
```

## How to use the Web Portal

Once the app is running:

1. **Manager Dashboard (`/manager`):** Open this page in the control room. It displays a real-time list of all gate access events, counters for entry/exit, and allows managers to view or resolve security incidents manually.
2. **Tablet Guard View (`/tablet`):** Provide this interface to guards stationed at physical gates. It displays simplified incoming scans meant to quickly verify whether a vehicle is allowed or denied entry.
3. **RFID Scanners:** Your RFID scanners (e.g. handhelds or antennas) should be configured to hit the `/api/abiot/ingest` endpoint whenever they scan a vehicle. The payload parameters match the standard ABIOT format (e.g. `uhf_epc_hex`, `uhf_tid`, `reader_id`, `mode`, `gate_id`, `direction`).
4. **Real-time Sync:** As soon as an RFID scanner hits the ingest endpoint, the Next.js server detects the new event, converts the raw scan to an `access_event`, and broadcasts a WebSocket message. Both the `/manager` and `/tablet` views will instantly update without requiring a page refresh.

## Database & Supabase Integration

This project relies on Supabase for data storage. The reference schema is in [`supabase/schema.sql`](./supabase/schema.sql).

### Typical setup:

1. Create a Supabase project.
2. Run the SQL script from `supabase/schema.sql` in the Supabase SQL Editor.
3. Add your Supabase credentials and URLs to `.env.local` (or your host environment).

If Supabase server credentials are missing (`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`), the app will fall back to an in-memory demo behavior for local development.

## Free Tier Keep-Alive System

This app includes built-in scripts inside `server.mjs` to keep your free-tier services active:
- **Render Keep-Alive:** Pings the `PUBLIC_APP_URL` every 5 minutes to prevent the Render web service from sleeping after 15 minutes of inactivity.
- **Supabase Keep-Alive:** Runs a lightweight `SELECT` query against your Supabase database every 4 days to prevent it from being paused by Supabase after 7 days of inactivity.

Ensure you have `PUBLIC_APP_URL` set in your environment variables for the Render Keep-Alive to work properly.

## Environment Variables

Review [`.env.example`](./.env.example) for all available variables.

### Required for Supabase mode:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Required for Keep-Alive system:
- `PUBLIC_APP_URL` (e.g. `https://my-app.onrender.com`)

### Optional integration settings:
- `CONVERT_BATCH_SIZE`, `EVENT_FETCH_LIMIT`, `CONVERT_INTERNAL_TOKEN`
- ABIOT integrations (`ABIOT_API_BASE_URL`, `ABIOT_LOOKUP_URL`, `ABIOT_UPDATE_URL`, etc.)
- Table overrides (`RAW_SCAN_TABLE`, `ACCESS_EVENTS_TABLE`, etc.)

## API Summary

- `GET /api/events?surface=manager|tablet&gateId=...`: Fetches recent access events.
- `GET /api/abiot/ingest`: Main ingestion point for ABIOT RFID scanners.
- `POST /api/events/{eventKey}/resolve`: Manually resolve an event.
- `POST /api/convert/run`: Triggers the pending raw scan conversion manually.
- `POST /api/abiot/register`: Register a new vehicle to ABIOT directly from the portal.
- `POST /api/fetch-latest`: Forces a manual refresh of latest events.

## Deployment Notes

This project uses a custom Node server (`server.mjs`) to support WebSockets, which means it **cannot** be deployed as a standard serverless app (like a default Vercel deployment).

Deploy it to a host that supports a long-running Node process (e.g., Render, Railway, DigitalOcean App Platform, or a VPS).
