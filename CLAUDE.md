# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kwento Ko** ("My Story") — Filipino children's book story generator by Crafts by AlibebePH.
Tagline: *"Likhain ang iyong kwento. Create your story."*

Generates story text, character profiles, image prompts, in-app images (Pro/Business), and print-ready PDF books. No third-party branding references (never mention Bibong Pinay, Dorcas Brion, or Cass Brion).

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express — all logic in `backend/server.js` |
| Frontend | Single `frontend/index.html` — vanilla JS, no framework, no build step |
| Database | SQLite via `better-sqlite3` → `data/kwento.db` |
| Auth | JWT (bcrypt, 30-day token, `localStorage`) |
| PDF | Puppeteer (server-side book compilation) + jsPDF (client-side simple exports) |
| DOCX | docx.js (CDN, client-side) |
| Deployment | Docker Compose, plain HTTP; HTTPS via Cloudflare Tunnel |

## Directory Structure

```
kwento-ko/
├── docker-compose.yml
├── .env.example
├── .env                    # gitignored — never commit
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js           # ALL API routes + business logic
├── frontend/
│   └── index.html          # ENTIRE frontend in one file
└── data/
    └── kwento.db           # SQLite DB, volume-mounted
```

## Development Commands

```bash
# Start the app
docker compose up -d

# Rebuild after backend changes
docker compose up -d --build

# View logs
docker compose logs -f

# Access running container
docker compose exec kwento-ko sh

# Stop
docker compose down
```

No lint or test commands are defined — the project has no build step and no test suite.

## Environment Configuration

Copy `.env.example` to `.env` before first run. Key variables:

- `AI_ENCRYPTION_KEY` — **32 chars, set once, never change** (rotating it corrupts all stored API keys)
- `JWT_SECRET` — min 32 chars
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — separate from user auth
- `TEXT_AI_PROVIDER` / `IMAGE_AI_PROVIDER` / `COMPILE_AI_PROVIDER` — `gemini` | `openrouter` | `ollama` | `fal` | `replicate`

**AI keys are bootstrap-only in `.env`** — after first run, all key management happens via Admin Dashboard. Runtime source of truth is the `ai_provider_settings` SQLite table (AES-256 encrypted).

## Architecture

### Backend (`server.js`) — Key Classes

- **`AISettingsManager`** — loads active AI providers from SQLite (5-min cache), decrypts keys, handles `getActiveProvider(feature)`, `refreshCache()`, `testConnection()`, `updateProvider()`, `switchActiveProvider()`
- **`OdooClient`** — dual Odoo instances (Primary = prod, Secondary = staging). Auto-failovers on 5s timeout; if both down, grants full access for 24h from SQLite cache
- **`AIProviderFactory`** — unified interface: `textAI.generate(prompt)`, `imageAI.generate(prompt, options)`, `compileAI.layout(storyData, format)`

### AI Provider Tiers

| Feature | Providers |
|---------|-----------|
| Text | Gemini (`@google/generative-ai`), OpenRouter (fetch), Ollama (fetch, 120s timeout) |
| Image | Gemini Imagen, fal.ai (`@fal-ai/client`), Replicate (`replicate` pkg) |
| Compile (layout) | Same pool as text AI |

### Subscription Tiers

| Tier | Stories/day | Images/mo | Book Compile |
|------|-------------|-----------|--------------|
| Free (₱0) | 3 | 0 | ❌ |
| Pro (₱199/mo) | 20 | 30 | ✅ Basic |
| Business (₱599/mo) | Unlimited | 150 | ✅ Advanced + white-label |
| Tester | Custom | Custom | Admin-assigned |

Usage is tracked in SQLite (speed layer) and async-synced to Odoo (billing accuracy layer).

### Book Compilation

`POST /api/compile-book` → Compile AI generates `layoutJSON` → rendered to HTML → Puppeteer → PDF download. Print formats: A5 Booklet on A4, A4 Portrait, US Letter/KDP 6×9, Square 8×8.

## API Route Summary

- `POST /api/auth/register|login` / `GET /api/auth/me`
- `POST /api/generate-character|story|regenerate-page|generate-image|compile-book` (rate-limited: 20 req/15min/IP)
- `GET|POST|PUT|DELETE /api/library/:id` (auth required)
- `GET /api/admin/*` (admin auth required — separate from JWT user auth)
- `GET /api/admin/ai-settings` + CRUD for AI provider management
- `GET /api/health` — returns Odoo status, AI provider, maintenance state

## SQLite Tables

`users`, `stories`, `story_images`, `usage_log`, `usage_counters`, `referrals`, `affiliate_earnings`, `promo_codes`, `promo_usage`, `system_settings`, `odoo_sync_queue`, `ai_provider_settings`, `ai_key_audit_log`

## Security Rules

- **Never return decrypted API keys** in any response — only `api_key_hint` (last 4 chars)
- All `/api/admin/*` routes require admin auth check (separate from user JWT)
- All AI keys encrypted AES-256 before storing; `AI_ENCRYPTION_KEY` from `.env`
- Promo codes always validated server-side
- Rate limit test endpoint: max 10 tests/admin/5min

## Visual Design

CSS variables: `--coral: #FF6B6B`, `--sun-yellow: #FFD63A`, `--sky: #4FC3F7`, `--leaf: #66BB6A`, `--deep-blue: #1A237E`

Fonts (Google CDN): Baloo 2 (headings), Nunito (body/story), Quicksand (UI labels), Pacifico (logo only)

Mobile-first, min-width 375px. Rounded corners (16-24px). No framework — pure CSS + vanilla JS.

## Deployment Context

- **PROD:** CT 4001 on proxmox02 (192.168.1.126)
- **UAT:** CT 4002 on proxmox01 (192.168.1.125)
- Both cloned from CT 103 (Odoo LXC base)
- Billing handled by two separate Odoo containers (Primary + Secondary), managed separately from this repo

## Dockerfile Notes

Uses `node:20-alpine` + `chromium` (Alpine) for Puppeteer. Uses `puppeteer-core` (not `puppeteer`). Sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` and `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`.

## Prompt Engineering (Gemini / All Text AI)

- Filipino: use `Nanay, Tatay, Lola, Lolo, Kuya, Ate` — NOT `Ina, Ama`
- Never rhyme unless explicitly requested — write natural narrative prose
- Sentence length gated by age range (2-4: max 8 words → 6-8: max 20 words)
- Cause & effect moment on pages 4-6; ages 2-4 = extremely mild
- Image prompts always include: art style `"whimsical digital illustration, soft rounded shapes, flat pastel color palette, subtle traditional watercolor texture, children's book illustration style, warm and friendly atmosphere"`
