# This folder

Express API + better-sqlite3, deployed on Railway. Single entry point: `server.js`.

# Rules that only apply here

- better-sqlite3 is synchronous — no `await` on DB calls; keep handlers fast.
- Schema changes use the idempotent startup pattern in `server.js`
  (`try { db.exec('ALTER TABLE …') } catch {}`) — there is no migration framework.
- Email/Slack side effects fire via `setImmediate` (fire-and-forget). Never block or fail an
  API response on them.
- `GET /ack/:token` must stay side-effect-free (email scanners hit it); state changes on POST only.
- `dms.db` contains real local data — no destructive SQL against it, never commit it.
- Tests (`__tests__/`, jest) are hermetic: they set `DB_PATH=':memory:'` and pin env vars
  **before** requiring `server.js`. Keep new tests that way — never depend on `dms.db` or real env.
