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
  - When `avatar_url` or `badge.image_url` is set (either `https://...` or `data:image/...`), the backend calls OpenAI Moderation.
  - If moderation is not configured, the API returns **503** and does **not** store the image.

This backend is already deployed as a Vercel Serverless Function via `backend/vercel.json` (`@vercel/node`), so moderation runs “inside Vercel” automatically.

### Environment variables

These are evaluated by the backend at runtime:

- **Text moderation**
  - `TEXT_MODERATION_ENABLED` (default: `true`)

- **Image moderation**
  - `IMAGE_MODERATION_ENABLED` (default: `true`)
  - `IMAGE_MODERATION_PROVIDER` (default: `openai`)
  - `OPENAI_API_KEY` (**required** when image moderation is enabled and an image is being set)
  - `OPENAI_MODERATION_MODEL` (default: `omni-moderation-latest`)
  - `OPENAI_MODERATION_TIMEOUT_MS` (default: `8000`)

### Why “fail-closed” for images?

Without an image moderation provider, the system cannot reliably detect profanity/abuse embedded in images (including text inside images). Allowing uploads without checks is how unsafe content gets in.

### Recommended next steps (global-scale hardening)

- **Store images in object storage** (S3/R2/etc.) and only accept *your own* URLs (avoid arbitrary third-party URLs).
- **Async moderation pipeline**:
  - accept upload → store in quarantine → moderate → publish if clean, delete if rejected
- **Add an admin review queue** for borderline/appealable cases.
- **Add per-field policies** (different strictness for usernames vs. longer bios).

