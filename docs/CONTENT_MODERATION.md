## Content moderation (text + images)

This project accepts user-generated content in several places (usernames, profile fields, league/badge names, and user/badge images).
To support a global user base, moderation must be enforced **server-side** (frontend checks alone are bypassable).

### What’s implemented in this repo

- **Text profanity blocking (non‑AI)**: server-side profanity detection via `leo-profanity` on:
  - `POST /api/auth/register` (`username`, `first_name`, `last_name`)
  - `PUT /api/auth/profile` (`first_name`, `last_name`, `avatar_url`)
  - `PUT /api/users/:id` (profile text fields + `avatar_url`)
  - `POST/PUT /api/badges` (badge `name`, `description`, etc. + `image_url`)
  - `POST/PUT /api/leagues` (league `name`, `description`, etc.)
  - `POST /api/leagues/:id/roster` (placeholder `display_name`)

- **Image moderation (AI, fail-closed)**:
  - (Rolled back) Image moderation was removed because badge images are now restricted to site admins and the project prefers to avoid external API costs/rate limits.

This backend is already deployed as a Vercel Serverless Function via `backend/vercel.json` (`@vercel/node`), so moderation runs “inside Vercel” automatically.

### Environment variables

These are evaluated by the backend at runtime:

- **Text moderation**
  - `TEXT_MODERATION_ENABLED` (default: `true`)

If you re-enable image moderation in the future, add it back behind env flags and configure the provider in the backend only.

### Important note about images

Without an image moderation provider, the system cannot reliably detect profanity/abuse embedded in images (including text inside images). For now, this repo mitigates risk by restricting badge creation/update/deletion to **site admins**.

### Recommended next steps (global-scale hardening)

- **Store images in object storage** (S3/R2/etc.) and only accept *your own* URLs (avoid arbitrary third-party URLs).
- **Async moderation pipeline**:
  - accept upload → store in quarantine → moderate → publish if clean, delete if rejected
- **Add an admin review queue** for borderline/appealable cases.
- **Add per-field policies** (different strictness for usernames vs. longer bios).

