# Kwento Ko — Filipino Children's Book Story Generator
# Claude Code Build Prompt — COMPLETE FINAL VERSION
# By: Crafts by AlibebePH | alibebeph.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## CRITICAL: READ FIRST

This app is TEXT + AI GENERATION only.

✓ Generates story text via AI
✓ Generates character profiles
✓ Generates copy-paste image prompts
✓ Generates images IN-APP (Pro/Business via image AI)
✓ Compiles stories + images into print-ready PDF books
✓ Discussion guides, character cards, exports
✗ Does NOT use any third-party branding
✗ No references to Bibong Pinay, Dorcas Brion,
  Cass Brion, or any external source anywhere

Owner:   Crafts by AlibebePH
Website: alibebeph.com
Footer:  "© 2025 Crafts by AlibebePH |
          alibebeph.com | All rights reserved."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## STITCH MCP: stitch-Personal

  Project: Kwento Ko Story Creator
  - ID: 3430597813726681292
  - Type: Text-to-UI Pro (Mobile)
  - Created: April 6, 2026
  - Last updated: April 6, 2026
  - Visibility: Private

  Design System — "The Modern Bahay Kubo"
  - Theme: Light / Expressive
  - Primary color: Coral #ac4218 (override #FF7F50)
  - Secondary: Teal #006f7e
  - Tertiary: Leaf Green #437000
  - Fonts: Plus Jakarta Sans (headlines/labels) + Be Vietnam Pro (body)
  - Roundness: Full pill style
  - Spacing scale: 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## APP IDENTITY

Name:    Kwento Ko
Meaning: "My Story" in Filipino
Tagline: "Likhain ang iyong kwento. Create your story."

Target users:
  - Parents creating books for their children
  - Teachers creating classroom reading materials
  - Content creators selling on KDP, Etsy, Gumroad

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## TECH STACK

Backend:     Node.js + Express
Frontend:    Single index.html (vanilla JS, no framework,
             no build step)
Database:    SQLite via better-sqlite3
             (stories, usage counters, cache)
Auth:        JWT (email + password, bcrypt,
             30-day token, stored in localStorage)
PDF Engine:  Puppeteer (server-side, for book compilation)
             jsPDF (client-side, for simple text exports)
DOCX Export: docx.js (CDN, client-side)
Deployment:  Docker Compose, plain HTTP
             (HTTPS via Cloudflare Tunnel externally)
Port:        Configurable via .env (default 3000)
Billing:     Odoo (two separate containers,
             operator-managed on Proxmox)
Payments:    PayMongo or Xendit via Odoo
             (GCash, Maya, credit/debit cards)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## DIRECTORY STRUCTURE

kwento-ko/
├── docker-compose.yml
├── .env.example
├── .env                        # gitignored
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js               # all API + logic
├── frontend/
│   └── index.html              # entire frontend
└── data/
    └── kwento.db               # SQLite, volume mounted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ENVIRONMENT CONFIGURATION (.env)

All secrets and config live here. Never expose to client.

─── ODOO (Primary = Production, Secondary = Staging) ──

# Primary Odoo — Production
ODOO_PRIMARY_URL=https://192.168.1.8
ODOO_PRIMARY_DB=EDIT_THIS_DB_NAME
ODOO_PRIMARY_USER=admin
ODOO_PRIMARY_PASSWORD=SantosB5L18#!
ODOO_PRIMARY_API=5f3cffd3039952de4387c883874684997727f578

# Secondary Odoo — Staging / Testing
ODOO_SECONDARY_URL=https://192.168.1.9
ODOO_SECONDARY_DB=EDIT_THIS_DB_NAME
ODOO_SECONDARY_USER=admin
ODOO_SECONDARY_PASSWORD=SantosB5L18#!
ODOO_SECONDARY_API=f08656b23857292c16047921ccfb6baf9963c289

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## AI PROVIDER KEY MANAGEMENT SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Architecture Decision: Hybrid (.env + Database)

Use a TWO-LAYER approach:

LAYER 1 — .env (Bootstrap only):
  Used ONLY on first startup if database has no keys
  Acts as the initial seed values
  Never read again once DB has entries
  Safe fallback if DB is wiped

LAYER 2 — SQLite ai_provider_settings table:
  Single source of truth at runtime
  Admin-editable via Admin Dashboard UI
  Encrypted at rest (AES-256)
  Audit logged (who changed what, when)
  Live-reloaded without restart

This means:
  - Changing an API key = Admin Dashboard only
  - No SSH required after initial deploy
  - No docker restart needed for key changes
  - Expired keys replaced in seconds via UI
  - Full audit trail of all key changes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## .env — BOOTSTRAP SEED ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# These values seed the DB on FIRST RUN ONLY.
# After first run, all changes via Admin Dashboard.
# Leave as EDIT_THIS if you want to configure
# entirely via Admin Dashboard on first login.

# Encryption key for API keys stored in DB
# NEVER change this after first run —
# it will corrupt all stored encrypted keys
AI_ENCRYPTION_KEY=EDIT_THIS_32_CHAR_RANDOM_STRING

# ── TEXT AI ───────────────────────────────────────────
TEXT_AI_PROVIDER=gemini

GEMINI_API_KEY=EDIT_THIS_KEY
GEMINI_TEXT_MODEL=gemini-2.0-flash

OPENROUTER_API_KEY=EDIT_THIS_KEY
OPENROUTER_TEXT_MODEL=meta-llama/llama-3.1-70b-instruct

OLLAMA_HOST=http://EDIT_THIS_IP:11434
OLLAMA_TEXT_MODEL=qwen2.5:7b

# ── IMAGE AI ──────────────────────────────────────────
IMAGE_AI_PROVIDER=gemini

GEMINI_IMAGE_MODEL=imagen-3.0-generate-002

FAL_API_KEY=EDIT_THIS_KEY
FAL_IMAGE_MODEL=fal-ai/flux/dev

REPLICATE_API_KEY=EDIT_THIS_KEY
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-1.1-pro

# ── COMPILE AI ────────────────────────────────────────
COMPILE_AI_PROVIDER=gemini

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SQLITE SCHEMA — ai_provider_settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE ai_provider_settings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  feature         TEXT NOT NULL,
  -- 'text' | 'image' | 'compile'
  provider        TEXT NOT NULL,
  -- 'gemini' | 'openrouter' | 'ollama'
  -- 'fal' | 'replicate'
  is_active       INTEGER DEFAULT 0,
  -- 1 = currently selected for this feature
  api_key_enc     TEXT,
  -- AES-256 encrypted, null for ollama
  api_key_hint    TEXT,
  -- last 4 chars only e.g. "...x7Kp"
  -- shown in UI, never the full key
  model           TEXT NOT NULL,
  extra_config    TEXT,
  -- JSON blob: { host, timeout, etc }
  last_tested_at  DATETIME,
  last_test_ok    INTEGER,
  -- 1 = passed, 0 = failed, null = never tested
  last_test_msg   TEXT,
  -- success message or error string
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by      TEXT
  -- admin email who last changed this
);

CREATE TABLE ai_key_audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  feature      TEXT NOT NULL,
  provider     TEXT NOT NULL,
  action       TEXT NOT NULL,
  -- 'key_updated' | 'provider_switched'
  -- | 'model_changed' | 'test_run'
  -- | 'test_passed' | 'test_failed'
  result       TEXT,
  admin_email  TEXT NOT NULL,
  ip_address   TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed on first run from .env if table is empty:
-- INSERT INTO ai_provider_settings for each
-- provider/feature combination from .env values

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## BACKEND — AISettingsManager CLASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implement AISettingsManager in server.js:

  constructor():
    Load active providers from SQLite into memory
    Set up in-memory cache with 5-minute TTL
    Decrypt keys on load using AI_ENCRYPTION_KEY

  getActiveProvider(feature):
    Returns { provider, apiKey, model, extraConfig }
    for the given feature ('text'|'image'|'compile')
    Reads from in-memory cache (fast path)
    Falls back to DB if cache is stale

  refreshCache():
    Re-reads all active providers from SQLite
    Decrypts keys fresh
    Called automatically every 5 minutes
    Called immediately after any admin key update
    This means key changes take effect within
    seconds with no restart needed

  testConnection(feature, provider, apiKey, model):
    Sends a minimal real API call to verify:

    GEMINI TEXT test:
      POST to Gemini with prompt:
      "Reply with exactly one word: OK"
      Pass if response contains "OK"
      Timeout: 10s

    GEMINI IMAGE test:
      Send minimal image generation request
      with a simple 1-word prompt "sunshine"
      Pass if returns any valid image data
      Timeout: 30s

    OPENROUTER test:
      POST /v1/chat/completions
      prompt: "Reply with exactly one word: OK"
      Pass if choices[0].message.content has "OK"
      Timeout: 15s

    OLLAMA test:
      GET {host}/api/tags
      Pass if HTTP 200 and model in list
      If model not found: fail with message
      "Model [name] not found on this Ollama instance"
      Timeout: 8s

    FAL test:
      POST minimal generation request
      smallest possible params
      Pass if returns image URL or base64
      Timeout: 45s

    REPLICATE test:
      POST minimal prediction
      Poll for up to 30s
      Pass if prediction completes
      Timeout: 60s

    Returns:
    {
      ok: true | false,
      latencyMs: number,
      message: "Connected successfully" | error string,
      model: "confirmed model name if returned by API"
    }

  updateProvider(feature, provider, apiKey, model,
                 extraConfig, adminEmail, ipAddress):
    Encrypt apiKey using AES-256 + AI_ENCRYPTION_KEY
    Store api_key_hint as last 4 chars of raw key
    Update SQLite row
    Log to ai_key_audit_log
    Call refreshCache() immediately
    Return { ok: true }

  switchActiveProvider(feature, provider,
                       adminEmail, ipAddress):
    Set is_active=0 for all rows where feature matches
    Set is_active=1 for target provider+feature row
    Log to ai_key_audit_log with action 'provider_switched'
    Call refreshCache() immediately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ADMIN API ROUTES — AI KEY MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All routes require admin auth header.
Never return decrypted API keys in any response.
Only return api_key_hint, never api_key_enc.

GET /api/admin/ai-settings
  Returns all providers per feature:
  {
    text: [
      {
        provider: "gemini",
        is_active: true,
        api_key_hint: "...x7Kp",
        model: "gemini-2.0-flash",
        last_tested_at: "ISO timestamp",
        last_test_ok: true,
        last_test_msg: "Connected in 423ms"
      },
      { provider: "openrouter", ... },
      { provider: "ollama", ... }
    ],
    image: [ ... ],
    compile: [ ... ]
  }

POST /api/admin/ai-settings/test
  Body: { feature, provider, apiKey, model,
          extraConfig? }
  apiKey can be:
    - New key being tested before saving
    - "__USE_STORED__" string to test existing
      stored key without re-entering it
  Calls AISettingsManager.testConnection()
  Logs test attempt to audit log
  Returns:
  {
    ok: true | false,
    latencyMs: 423,
    message: "Connected successfully",
    model: "gemini-2.0-flash"
  }

PUT /api/admin/ai-settings/:feature/:provider
  Body: { apiKey?, model?, extraConfig? }
  apiKey is optional — if omitted, only model/config
  is updated (existing encrypted key kept)
  Calls AISettingsManager.updateProvider()
  Automatically calls test after update
  Returns: { ok: true, testResult: { ... } }

PUT /api/admin/ai-settings/:feature/active
  Body: { provider }
  Switches which provider is active for feature
  Calls AISettingsManager.switchActiveProvider()
  Returns: { ok: true, activeProvider: "gemini" }

GET /api/admin/ai-settings/audit
  Query: ?limit=50&feature=text&provider=gemini
  Returns audit log entries (newest first)
  {
    logs: [{
      feature, provider, action,
      result, admin_email, ip_address, created_at
    }]
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ADMIN UI — AI PROVIDER SETTINGS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Location: Admin Dashboard → AI Monitor → Provider Settings

3 collapsible sections (one per feature):
  📝 Story Text AI
  🎨 Image Generation AI
  📚 Book Compilation AI

Each section expands to show provider cards.

─── PROVIDER CARD DESIGN ─────────────────────────────

One card per provider. Cards show side by side
on desktop (2-col or 3-col), stacked on mobile.

ACTIVE PROVIDER CARD:
  Green left border 4px
  Header row:
    Provider logo/emoji + name Baloo 2 600
    "ACTIVE" green badge pill right
  Body:
    API Key row:
      🔑 "API Key" label
      Masked display: "••••••••••••••••x7Kp"
      (only hint shown, never full key)
      [✏️ Update Key] small ghost button
        → reveals inline key update form:
          Password-type input for new key
          "Paste your new API key here"
          [💾 Save] coral + [Cancel] ghost
          On save: auto-runs test immediately
    Model row:
      🤖 "Model" label
      Editable inline text input with current model
      Dropdown for known models of this provider:
        Gemini: gemini-2.0-flash |
                gemini-1.5-flash | gemini-1.5-pro
        OpenRouter: text input (user types model)
        Ollama: text input (user types model name)
        fal.ai: fal-ai/flux/dev |
                fal-ai/flux-realism |
                fal-ai/flux-pro
        Replicate: text input
      [💾 Save Model] small ghost button on change
    Extra Config row (Ollama only):
      🌐 "Ollama Host" label
      Editable text input with current host URL
      [💾 Save] on change

  Test Status row:
    Last tested: [relative time e.g. "2 hours ago"]
    Result chip:
      ✅ "Connected — 423ms" (green chip)
      ❌ "Failed — Invalid API key" (red chip)
      ⚪ "Never tested" (gray chip)
    [▶ Test Connection] coral outlined button
      → Shows inline spinner: "Testing..."
      → Replaces with result chip immediately
      → If fail: shows full error message expandable

  Footer: "Last updated by admin@example.com
           on April 6, 2025 at 3:42 PM"
    Quicksand 12px muted

INACTIVE PROVIDER CARD:
  Gray left border 4px (muted)
  Header row:
    Provider emoji + name muted
    [Set as Active] coral ghost button right
      → shows confirmation: "Switch to [provider]
         for [feature]? Current active will be
         deactivated." [Confirm] [Cancel]
  Body: same as active card but muted
  Test button still works (test before activating)

─── KEY UPDATE FLOW ──────────────────────────────────

When admin clicks [✏️ Update Key]:

Step 1 — Input form appears inline:
  Password input (text masked by default)
  👁 Show/hide toggle on input
  "Paste your new [Provider] API key here"
  Helper text: provider-specific tip:
    Gemini: "Get your key from aistudio.google.com"
    OpenRouter: "Get from openrouter.ai/keys"
    fal.ai: "Get from fal.ai/dashboard"
    Replicate: "Get from replicate.com/account"
    Ollama: "No key needed — just host URL"
  [💾 Save & Test] coral button
  [Cancel] ghost button

Step 2 — On Save & Test:
  Key saved (encrypted) to DB immediately
  Test runs automatically (spinner shows)
  "Saving and testing your new key..."

Step 3a — Test PASSED:
  ✅ Green success banner inline:
  "Key saved and verified! ✓
   Connected to [provider] in [X]ms"
  Form collapses back to masked display
  api_key_hint updates to show new last 4 chars

Step 3b — Test FAILED:
  ❌ Red error banner inline:
  "Key saved but connection failed."
  Error message shown (e.g. "Invalid API key",
  "Quota exceeded", "Model not found")
  Key IS saved despite failure
    (admin may want to use it anyway)
  "The key has been saved. You can try again
   or contact [provider] support."
  [🔄 Retry Test] + [Keep Anyway] buttons

─── AUDIT LOG TAB ────────────────────────────────────

Below provider cards: "📋 Recent Changes" section
Collapsible, shows last 10 entries by default
[View Full Audit Log] link opens full page

Audit log table:
  Timestamp · Admin · Feature · Provider
  · Action · Result
  Color-coded action chips:
    key_updated → blue
    provider_switched → purple
    test_passed → green
    test_failed → red
    model_changed → yellow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## AUTOMATIC KEY EXPIRY DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When any AI API call fails in production:
  Check if error is key-related:
    HTTP 401 → "Invalid API key"
    HTTP 403 → "API key lacks permission"
    HTTP 429 → "Quota exceeded / billing issue"
    Error message contains: "invalid_api_key",
      "authentication", "unauthorized",
      "quota", "billing"

  If key-related error detected:
    Set last_test_ok=0, last_test_msg=error
      in ai_provider_settings for that provider
    Send admin notification email:
      Subject: "⚠️ Kwento Ko — [Provider] API
                key issue detected"
      Body: provider + feature + error + timestamp
            + link to Admin Dashboard AI settings
    Show warning in Admin Dashboard overview:
      Amber card: "⚠️ [Provider] API key issue
                  detected for [feature].
                  [→ Fix Now] button"
    DO NOT show error to end users —
      show friendly message instead:
      "Story generation is temporarily unavailable.
       Please try again in a few minutes."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## SECURITY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER in any API response:
  Return decrypted API keys
  Return api_key_enc column value
  Log raw API keys anywhere

ALWAYS:
  Encrypt API keys with AES-256 using
    AI_ENCRYPTION_KEY before storing
  Return only api_key_hint (last 4 chars)
    in all admin API responses
  Require admin auth on all
    /api/admin/ai-settings/* routes
  Log all key changes with admin email + IP
  Rate limit test endpoint:
    Max 10 tests per admin per 5 minutes
    to prevent API quota abuse

AI_ENCRYPTION_KEY:
  Must be exactly 32 characters
  Set once in .env, never change
  Add to .env.example as:
    AI_ENCRYPTION_KEY=GENERATE_32_CHAR_RANDOM_STRING
  Add README warning:
    "⚠️ Never change AI_ENCRYPTION_KEY after first
     run. Doing so will invalidate all stored API
     keys and require re-entering them all."

─── APP CONFIG ───────────────────────────────────────

PORT=3000
JWT_SECRET=EDIT_THIS_LONG_RANDOM_STRING_MIN_32_CHARS
ALLOWED_ORIGIN=*
NODE_ENV=production

# Admin access
ADMIN_EMAIL=EDIT_THIS_ADMIN_EMAIL
ADMIN_PASSWORD=EDIT_THIS_ADMIN_PASSWORD

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ODOO ARCHITECTURE

### Two Container Roles:
  Primary   → Production billing & subscriptions
  Secondary → Staging, testing, developer accounts

### Failover Logic (OdooClient class in server.js):

  Startup:
    Ping both instances via health check
    Log reachability of each

  Normal operation:
    All requests → Primary
    On Primary failure (5s timeout or HTTP error):
      → Retry on Secondary automatically
      → Log failover with timestamp
      → Increment failover counter

  Health check loop (every 60 seconds):
    Ping both instances
    If Primary recovers → resume routing to Primary

  If BOTH instances are down:
    Check SQLite cached subscription tier
    Allow FULL ACCESS for up to 24 hours
    Show persistent ribbon at top of every page:
      ⚠ "Kwento Ko is experiencing service issues.
         Full access is available until [DATE TIME].
         We are working to restore service."
    After 24 hours if still down:
      Show full-screen maintenance page:
        "Kwento Ko is currently under maintenance.
         We'll be back soon. Thank you for your patience."
        Show estimated restore time if available

  GET /api/health response:
  {
    status: "ok" | "degraded" | "maintenance",
    odoo: {
      primary: "up" | "down",
      secondary: "up" | "down",
      active: "primary" | "secondary" | "none",
      failoverCount: 0,
      lastFailover: null | "ISO timestamp"
    },
    ai: {
      textProvider: "gemini" | "openrouter" | "ollama",
      textModel: "model name string",
      imageProvider: "gemini" | "fal" | "replicate",
      imageModel: "model name string",
      compileProvider: "gemini" | "openrouter" | "ollama"
    },
    maintenanceUntil: null | "ISO timestamp"
  }

### Usage Tracking — Dual Source of Truth:

  SQLite (speed layer):
    - Increment usage counter on every generation
    - Check limit before every generation (fast)
    - Reset daily counters at midnight PH time
    - Reset monthly counters on 1st of month PH time
    - Cache subscription tier with 1-hour TTL

  Odoo (billing accuracy layer):
    - Sync usage to Odoo async after every generation
    - Do not block generation waiting for Odoo sync
    - If sync fails: queue it, retry every 5 minutes
    - Odoo is source of truth for billing reports
    - Admin can view discrepancies in admin dashboard

### Odoo API Operations:

  1. Verify subscription on every /api/generate-*:
     Returns:
     {
       tier: "free"|"pro"|"business"|"tester",
       storiesPerDay: 3|20|-1|custom,
       storiesPerMonth: 20|200|-1|custom,
       imagesPerMonth: 0|30|150|custom,
       canExportPDF: bool,
       canExportDOCX: bool,
       canCompileBook: bool,
       commercialLicense: bool,
       storageLimit: 5|100|-1|custom,
       watermark: bool,
       isTester: bool,
       testerNote: "string or null"
     }
     (-1 = unlimited, custom = tester-defined)

  2. Create Odoo partner on Kwento Ko registration

  3. Log usage event async after every generation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## AI PROVIDER SYSTEM

### Architecture: Separate Provider Per Feature

Each feature has its own independently configured
AI provider. Configured in .env, switchable without
code changes.

Build an AIProviderFactory in server.js that:
  - Reads TEXT_AI_PROVIDER, IMAGE_AI_PROVIDER,
    COMPILE_AI_PROVIDER from .env
  - Instantiates the correct client per feature
  - Exposes a unified interface:
    textAI.generate(prompt) → string
    imageAI.generate(prompt, options) → base64|url
    compileAI.layout(storyData, format) → layoutJSON

─── TEXT AI PROVIDERS ────────────────────────────────

All text providers must:
  - Accept a system prompt + user prompt
  - Return raw text (strip markdown fences)
  - Parse JSON from response safely
  - Throw standardized errors on failure

GEMINI (default pilot):
  Use @google/generative-ai SDK
  Model: from GEMINI_TEXT_MODEL env
  Enable JSON mode where supported
  Strip ```json fences before parsing

OPENROUTER:
  Use fetch to https://openrouter.ai/api/v1/chat/completions
  Auth: Authorization: Bearer OPENROUTER_API_KEY
  Header: HTTP-Referer: https://alibebeph.com
  Header: X-Title: Kwento Ko
  Model: from OPENROUTER_TEXT_MODEL env
  Response: choices[0].message.content

LOCAL OLLAMA:
  Use fetch to OLLAMA_HOST/api/generate
  Model: from OLLAMA_TEXT_MODEL env
  Set format: "json" for structured outputs
  Set stream: false
  Response: response field
  Timeout: 120s (local models are slower)

─── IMAGE AI PROVIDERS ───────────────────────────────

All image providers must:
  - Accept a text prompt + style options
  - Return image as base64 string or HTTPS URL
  - Save result to story's image gallery in SQLite
  - Throw standardized errors on failure

GEMINI IMAGEN:
  Use @google/generative-ai SDK
  Model: from GEMINI_IMAGE_MODEL env
  Return base64 PNG

FAL.AI (Flux):
  Use @fal-ai/client SDK
  Model: from FAL_IMAGE_MODEL env
  Options: { image_size: "landscape_16_9",
             num_inference_steps: 28,
             guidance_scale: 3.5 }
  Return image URL → fetch → base64

REPLICATE:
  Use replicate npm package
  Model: from REPLICATE_IMAGE_MODEL env
  Poll for completion (Replicate is async)
  Return image URL → fetch → base64

─── COMPILE AI (Layout Logic) ────────────────────────

The compile AI is responsible for ONE task only:
Given the story data + chosen print format,
return a structured layout JSON that tells
Puppeteer how to render each page.

It does NOT generate images or text.
It decides: margins, text position, image position,
font sizes, page order, cover design hints.

Use same provider pool as TEXT_AI:
  gemini | openrouter | ollama

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## BOOK COMPILATION SYSTEM

### How It Works:
1. User clicks "📚 Compile My Book"
2. Frontend sends story data + format choice to
   POST /api/compile-book
3. Backend calls Compile AI to generate layoutJSON
4. Backend renders layoutJSON to HTML template
5. Puppeteer converts HTML → print-ready PDF
6. PDF returned as download or emailed to user

### Print Formats (user picks one):

  A5 BOOKLET ON A4
    Output: A4 landscape PDF
    Layout: 2 A5 pages side by side per sheet
    Pages arranged for folding and stapling
    Print setting: "Booklet" or "Both sides, flip on
    short edge"
    Good for: home printing, personal use

  A4 PORTRAIT
    Output: A4 portrait PDF
    One story page per PDF page
    Standard home printer compatible
    Good for: simple home printing

  US LETTER / KDP (6×9 inches)
    Output: 6×9 inch PDF with KDP-spec margins:
      Inside: 0.375 inch
      Outside: 0.25 inch
      Top: 0.25 inch
      Bottom: 0.25 inch
    ISBN placeholder page included
    Good for: Amazon KDP self-publishing

  SQUARE 8×8 INCH
    Output: 8×8 inch PDF
    Good for: photo book services, Canva upload

### Book PDF Structure (all formats):

  Page 1:  Cover
           - Book title (large, Baloo 2)
           - Character illustration (if generated)
           - "By [user's display name]"
           - "Created with Kwento Ko | alibebeph.com"
             (removed for Business tier)

  Page 2:  Dedication page
           - "This book is dedicated to..."
           - User fills this in before compiling
             (text input in compile modal)

  Page 3:  Print Instructions Page
           - Title: "How to Print This Book"
           - Step-by-step instructions for chosen format
           - Diagrams described in text
           - e.g. for A5 Booklet:
             "Step 1: Select 'Print on both sides'
              Step 2: Set flip to 'Short edge'
              Step 3: Select 'Booklet' layout
              Step 4: Fold and staple in the middle"

  Pages 4–N: Story pages
           - Page number badge
           - Story text (primary language, large)
           - English translation below (if bilingual)
           - Illustration (if generated, positioned
             per layout template)
           - Cause & effect callout if applicable

  Page N+1: Moral of the Story
           - Full-width banner page
           - Moral in primary language + English

  Page N+2: Discussion Guide
           - All sections from Tab 4

  Page N+3: About / Back Cover
           - Book blurb
           - "Created with Kwento Ko"
           - alibebeph.com URL

### Compile Modal (UI before compiling):

  Title: "Compile Your Book 📚"

  Fields:
    Dedication text (textarea, optional)
    Print format selector (4 cards with preview)
    Layout template (Classic / Modern / Educational)
    Include Discussion Guide (toggle, on by default)
    Include Print Instructions (toggle, on by default)
    Watermark (auto — shown for Free tier, hidden for Pro+)

  Business tier extra fields:
    Upload custom cover image
    Upload your logo
    Remove "Created with Kwento Ko" branding (toggle)
    Author name override (default: display name)

  [Preview Layout] button
    Shows a simplified wireframe of how pages will look

  [Compile & Download PDF] button
    Triggers /api/compile-book
    Shows progress bar: "AI is arranging your book..."
    Downloads PDF on completion

  [📧 Email Me the PDF] button (Pro+)
    Sends compiled PDF to registered email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## SUBSCRIPTION TIERS

─── 🆓 FREE — "Libreng Subukan" (₱0/month) ──────────

  Stories: 3/day, 20/month
  Language: English only
  Story length: 10 pages only
  Image generation: ❌
  Book compilation: ❌
  PDF/DOCX export: ❌ (copy text only)
  Save stories: 5 (deleted after 30 days)
  Watermark: ✅ on all exports
  Discussion guide: ✅
  Image prompts (text): ✅

─── ⭐ PRO — "Kwento Pro" (₱199/mo | ₱1,990/yr) ────

  Stories: 20/day, 200/month
  Languages: All (Filipino, Cebuano, Ilocano,
             Taglish, Bilingual)
  Story lengths: All (6/10/14 pages)
  Image generation: 30/month
    - "✨ Generate Image" button per prompt card
    - Custom prompt textbox before generating
    - "🔄 Regenerate" button
    - Images saved to story gallery
  Book compilation: ✅ Basic
    - All 4 print formats
    - Classic/Modern/Educational templates
    - Print instructions included
  PDF/DOCX/TXT export: ✅
  Save stories: 100 (permanent)
  Watermark: ❌
  Priority generation: ✅
  Version history: 3 versions per story
  Duplicate & remix: ✅
  Email PDF delivery: ✅
  Gift subscriptions: ✅

─── 💼 BUSINESS — "Negosyo Plan" (₱599/mo | ₱5,990/yr)

  Everything in Pro plus:
  Stories: Unlimited
  Image generation: 150/month
  Batch generation: 5 stories at once
  Book compilation: ✅ Advanced
    - Custom cover upload
    - Own logo/branding
    - Remove Kwento Ko branding
    - ISBN placeholder page
    - Multi-story series compilation
    - KDP-ready specs
    - Etsy-ready package
  Commercial license: ✅ Full rights
  White-label: ✅
  Story library: Unlimited
  Collections/series manager: ✅
  Bulk export: ✅

─── 🧪 TESTER — "Test Account" (Admin-assigned) ─────

  Special tier assigned manually by admin only
  Not purchasable by users
  Fully customizable limits per tester:
    storiesPerDay: any number
    storiesPerMonth: any number
    imagesPerMonth: any number
    tier features: any combination
  Tester badge shown in their profile: 🧪 Tester
  Tester note: admin can add a note visible to tester
    e.g. "Beta tester — please report bugs to admin"
  Tester accounts managed in Admin Dashboard

─── 🎁 LIFETIME — Launch Promo (₱2,999 one-time) ────

  Pro tier features, forever
  Not available after launch period ends
  Admin can toggle availability on/off

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ADMIN DASHBOARD

Accessible at /admin route
Protected by ADMIN_EMAIL + ADMIN_PASSWORD from .env
Separate from regular user auth

─── Overview Cards ───────────────────────────────────
  Total users (free / pro / business / tester)
  Active subscriptions
  Stories generated today / this month
  Images generated today / this month
  Book compilations today / this month
  AI costs today / this month (estimated in PHP)
    Calculated from token counts × provider rates
  Revenue (from Odoo sync) today / this month
  Odoo status (primary / secondary / both down)

─── AI Usage & Cost Monitor ──────────────────────────
  Per provider breakdown:
    Text AI: provider name, model, tokens used,
             estimated cost in PHP
    Image AI: provider name, model, images generated,
              estimated cost in PHP
    Compile AI: provider, calls made, est. cost
  Cost per user (top 10 heaviest users)
  Daily cost trend chart (last 30 days)
  Alert threshold: if daily AI cost exceeds
    configurable amount → email admin

─── User Management ──────────────────────────────────
  Search users by email / name
  View user details:
    Subscription tier
    Stories generated (today / month / total)
    Images generated (month / total)
    Stories saved (count / storage)
    Registration date
    Last active date
  Actions per user:
    Upgrade / downgrade tier manually
    Assign Tester tier with custom limits
    Add tester note
    Reset usage counters
    Suspend account
    Delete account (with confirmation)

─── Tester Management ────────────────────────────────
  Dedicated section for tester accounts
  Create tester: email, custom limits, note
  View all active testers
  Remove tester status (reverts to free)

─── Odoo Sync Status ─────────────────────────────────
  Last successful sync timestamp
  Pending sync queue count
  Failed sync events (with retry button)
  Failover event log

─── System Settings ──────────────────────────────────
  Toggle AI providers per feature (without .env edit)
    (writes back to a settings table in SQLite,
     overrides .env at runtime)
  Toggle Lifetime plan availability
  Set maintenance mode manually
  Set maintenance message + estimated restore time

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## GROWTH & MARKETING FEATURES

─── Referral System ──────────────────────────────────
  Every user gets a unique referral link:
    kwentoko.com/?ref=UNIQUECODE
  Referrer reward: +5 free stories per successful
    referral (referree must complete registration)
  Tracked in SQLite referrals table:
    referrer_user_id, referred_user_id,
    referred_at, rewarded

─── Affiliate Program ────────────────────────────────
  Separate from referral system
  Admin manually assigns affiliate status to a user
  Affiliate gets: 20% commission on every paid
    subscription from their referral code
  Affiliate dashboard tab in their profile:
    Total referrals, conversions, earnings
    Payout request button (admin processes manually)
  Tracked in SQLite affiliate_earnings table

─── Promo Codes & Discounts ──────────────────────────
  Admin creates promo codes in Admin Dashboard:
    Code string (e.g. LAUNCH50)
    Discount type: percentage | fixed PHP amount
    Discount value
    Applies to: monthly | annual | lifetime | all
    Max uses (blank = unlimited)
    Expiry date (blank = no expiry)
    Tiers it applies to: pro | business | both
  Promo code field shown on upgrade/checkout page
  Validated against Odoo before applying
  Usage tracked in SQLite promo_usage table

─── Annual Plan ──────────────────────────────────────
  Pro annual: ₱1,990/year (save 2 months = ₱388)
  Business annual: ₱5,990/year (save 2 months)
  Shown prominently on pricing page
  Toggle in billing modal: [Monthly] ←→ [Annual]

─── Tester Accounts ──────────────────────────────────
  (see Tester tier in Subscription section above)
  Admin-created only, not self-service

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## APPLICATION FLOW — 4-STEP WIZARD

Progress bar: [① Character]→[② Story Setup]
              →[③ Generate]→[④ Your Book]

─── STEP 1: Character Builder ────────────────────────

Quick Mode (default):
  Character name (required text input)
  Character type (visual 2×2 card grid):
    🦊 Animal Friend
    🧒 Filipino Kid
    🧚 Fantasy Being
    ✏️ Custom (reveals textarea)
  Personality pills (pick up to 3):
    Matapang | Mausisa | Masaya | Mahal sa Lahat
    Matalino | Mahiyain | Palaro | Mabait
  Distinctive feature (optional text)

Advanced Mode (collapsed, "More Options ▼"):
  Character age, species, special ability,
  supporting character + relationship

Live Character Preview Card (updates in real-time)

─── STEP 2: Story Setup ──────────────────────────────

Story Tone (pills):
  🤣 Funny | 🌿 Gentle | 🗺️ Adventurous
  🌙 Mysterious | 💛 Heartwarming

Setting (card grid, Filipino label + English sub):
  🏙️ Lungsod | 🌾 Probinsya | 🌊 Dagat | 🌳 Gubat
  🏡 Tahanan | 🏫 Paaralan | ✨ Mahiwagang Lugar
  ✏️ Custom

Age Range (pills): [2-4] [3-5] [4-6] [5-7] [6-8]

Story Length (pills):
  [Short — 6 pages] [Standard — 10 pages]
  [Long — 14 pages]

Values Category (cards):
  ✝️ Christian | 👨‍👩‍👧 Filipino Family | 💡 Life Lessons
  🌿 Environment | 💛 Social-Emotional

Specific Lesson (dynamic pills per category)

Cause & Effect toggle (ON by default):
  Shows gentle wrong-choice + consequence + resolution
  Age-gated: 2-4 = extremely mild, 5-8 = slightly more

Language:
  Primary: English | Filipino | Cebuano | Ilocano
           | Taglish
  Bilingual toggle: adds English translation per page
    (auto-on and locked if Primary = English)

─── STEP 3: Generate ─────────────────────────────────

Phase A — Character Profile (auto on Step 3 entry):
  Calls POST /api/generate-character
  Shows: personality description, appearance,
         fun fact, catchphrase (speech bubble),
         character stats (4 progress bars),
         character design prompt (copy button)
  Notice: "Paste this into your AI art tool.
           Kwento Ko does not generate images."
           (shown below free-tier design prompt only)
  Buttons: [🔄 Regenerate] [✨ Write My Story →]

Phase B — Story Generation:
  Calls POST /api/generate-story
  Puppeteer-style progress animation
  Progress bar 0→100% over estimated time
  Cycling messages

─── STEP 4: Your Book (5 Tabs) ───────────────────────

Top bar: title, badge pills, [💾 Save] [📤 Export ▼]

Tabs: [📖 Story] [🎨 Image Prompts]
      [🃏 Character Card] [❓ Discussion Guide]
      [📚 My Library]

TAB 1 — Story:
  Back cover summary card
  10/14 story page cards with:
    Primary language text
    English translation (if bilingual)
    Cause & effect callout (if applicable)
    Illustration idea callout
    [🔄 Regenerate this page] (replaces single card)
  Moral banner at end
  [📚 Compile My Book] button (Pro/Business only)
    Free users see locked state with upgrade prompt

TAB 2 — Image Prompts:
  Notice banner (text prompts only for Free tier)
  Prompt style toggle: [DALL-E/Canva] ↔ [Midjourney]
    (client-side reformat only, no API call)
  For Pro/Business: [✨ Generate Image] button
    per prompt card with customization textbox
  Character blueprint prompt (full-width)
  Per-page prompts (one per story page)
  5 sticker/spot illustration prompts

TAB 3 — Character Card:
  Printable profile: name, type, personality,
  appearance, catchphrase bubble, fun fact,
  stats bars, design prompt + copy button
  [🖨️ Print Character Card]

TAB 4 — Discussion Guide:
  For Parents & Teachers section
  Before/While/After Reading questions
  Cause & Effect discussion (if enabled)
  Creative activities
  Prayer prompt (if Christian values)
  [📄 Export Discussion Guide as PDF]

TAB 5 — My Library:
  Guest: 3 localStorage stories + signup prompt
  Logged in: full library from SQLite
  Search + language filter pills
  Story cards: title, character, badges, date,
               [📖 Open] [🗑️ Delete]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## BACKEND API ROUTES

─── AUTH ─────────────────────────────────────────────
POST /api/auth/register
  Body: { email, password, displayName, avatarEmoji,
          referralCode? }
  → Creates Odoo partner async
  → Tracks referral if code provided
  Returns: { token, user }

POST /api/auth/login
  Body: { email, password }
  Returns: { token, user }

GET  /api/auth/me
  Header: Authorization: Bearer <token>
  Returns: { user, subscription, usageToday,
             usageMonth }

─── GENERATION (rate limited: 20 req/15min/IP) ───────
POST /api/generate-character
POST /api/generate-story
POST /api/regenerate-page
POST /api/generate-image
  Body: { promptText, customization?, storyId,
          pageIndex? }
  Calls IMAGE_AI_PROVIDER
  Saves image to SQLite story_images table
  Returns: { imageBase64, imageUrl }

POST /api/compile-book
  Body: { storyId, format, dedication?,
          includeDiscussionGuide, includePrintGuide,
          layoutTemplate, customCover?,
          removeBranding? }
  Step 1: Call COMPILE_AI for layoutJSON
  Step 2: Render HTML template with layoutJSON
  Step 3: Puppeteer → PDF
  Step 4: Return PDF as download stream
  Step 5: If emailPDF=true, email PDF to user

─── LIBRARY (auth required) ──────────────────────────
GET    /api/library
POST   /api/library
GET    /api/library/:id
PUT    /api/library/:id
DELETE /api/library/:id

─── ADMIN (admin auth required) ──────────────────────
GET  /api/admin/overview
GET  /api/admin/users
GET  /api/admin/users/:id
PUT  /api/admin/users/:id/tier
POST /api/admin/users/:id/tester
DELETE /api/admin/users/:id/tester
PUT  /api/admin/users/:id/suspend
GET  /api/admin/ai-costs
GET  /api/admin/odoo-sync
POST /api/admin/odoo-sync/retry
GET  /api/admin/promo-codes
POST /api/admin/promo-codes
DELETE /api/admin/promo-codes/:id
GET  /api/admin/affiliates
POST /api/admin/affiliates
GET  /api/admin/settings
PUT  /api/admin/settings

─── GROWTH ───────────────────────────────────────────
POST /api/promo/validate
  Body: { code, tier, billingCycle }
  Returns: { valid, discount, message }

GET  /api/referral/stats   (auth required)
GET  /api/affiliate/stats  (auth required)
POST /api/affiliate/payout-request (auth required)

─── SYSTEM ───────────────────────────────────────────
GET /api/health

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## SQLITE SCHEMA

CREATE TABLE users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  display_name     TEXT,
  avatar_emoji     TEXT DEFAULT '📚',
  tier             TEXT DEFAULT 'free',
  tier_cached_at   DATETIME,
  is_tester        INTEGER DEFAULT 0,
  tester_limits    TEXT,       -- JSON blob of custom limits
  tester_note      TEXT,
  is_admin         INTEGER DEFAULT 0,
  is_suspended     INTEGER DEFAULT 0,
  referral_code    TEXT UNIQUE,
  referred_by      INTEGER REFERENCES users(id),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at   DATETIME
);

CREATE TABLE stories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id)
                    ON DELETE CASCADE,
  title           TEXT NOT NULL,
  language        TEXT NOT NULL,
  tone            TEXT,
  age_range       TEXT,
  character_name  TEXT,
  page_count      INTEGER,
  story_data      TEXT NOT NULL,  -- full JSON blob
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE story_images (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id     INTEGER NOT NULL REFERENCES stories(id)
                 ON DELETE CASCADE,
  page_index   INTEGER,         -- null = character sheet
  prompt_used  TEXT,
  provider     TEXT,
  model        TEXT,
  image_data   TEXT,            -- base64 or URL
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usage_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL,
  -- 'story_generate'|'image_generate'|'book_compile'
  provider     TEXT,
  model        TEXT,
  tokens_used  INTEGER,
  cost_usd     REAL,
  synced_odoo  INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usage_counters (
  user_id          INTEGER PRIMARY KEY
                     REFERENCES users(id),
  stories_today    INTEGER DEFAULT 0,
  stories_month    INTEGER DEFAULT 0,
  images_month     INTEGER DEFAULT 0,
  compiles_month   INTEGER DEFAULT 0,
  last_reset_day   DATE,
  last_reset_month DATE
);

CREATE TABLE referrals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id      INTEGER REFERENCES users(id),
  referred_id      INTEGER REFERENCES users(id),
  referred_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  rewarded         INTEGER DEFAULT 0
);

CREATE TABLE affiliate_earnings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER REFERENCES users(id),
  referred_id  INTEGER REFERENCES users(id),
  amount_php   REAL,
  status       TEXT DEFAULT 'pending',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promo_codes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT NOT NULL, -- 'percent'|'fixed'
  discount_value REAL NOT NULL,
  applies_to     TEXT,          -- 'pro'|'business'|'all'
  billing_cycle  TEXT,          -- 'monthly'|'annual'|'all'
  max_uses       INTEGER,       -- null = unlimited
  uses_count     INTEGER DEFAULT 0,
  expires_at     DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promo_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id     INTEGER REFERENCES promo_codes(id),
  user_id     INTEGER REFERENCES users(id),
  used_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Seed default settings:
-- text_ai_provider, image_ai_provider,
-- compile_ai_provider, lifetime_plan_active,
-- maintenance_mode, maintenance_message,
-- maintenance_until, ai_cost_alert_threshold_php

CREATE TABLE odoo_sync_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  payload      TEXT NOT NULL,   -- JSON
  attempts     INTEGER DEFAULT 0,
  last_attempt DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## GEMINI PROMPT ENGINEERING RULES
## (Apply to all text AI providers via system prompt)

LANGUAGE QUALITY:
  English: Natural, warm, engaging children's prose
  Filipino/Tagalog: Conversational, as spoken at home
    Use: Nanay, Tatay, Lola, Lolo, Kuya, Ate
    NOT: Ina, Ama (too formal/textbook)
  Cebuano: Natural Bisaya as spoken in Cebu/Visayas
  Ilocano: Natural, simple, warm rural tone
  Taglish: Natural code-switching as Filipinos speak
  NEVER rhyme unless explicitly requested
  Write natural narrative prose throughout

Sentence length by age:
  2-4: max 8 words per sentence
  3-5: max 12 words
  4-7: max 16 words
  6-8: max 20 words

Bilingual translation:
  Must read as if originally written in English
  Never word-for-word literal translations

CAUSE & EFFECT:
  One wrong-choice moment around pages 4-6
  Show natural gentle consequence
  Character realizes, grows, resolves positively
  Ages 2-4: extremely mild (just a feeling)
  Ages 5-8: slightly more tangible, still gentle

CHARACTER CONSISTENCY:
  Name on every page
  Personality traits reflected in actions
  Catchphrase at least once
  Distinctive feature at least twice

CULTURAL AUTHENTICITY (Filipino settings):
  Include naturally: sinigang, adobo, bibingka,
  halo-halo, pan de sal, jeepney, tricycle,
  sari-sari store, bahay kubo, sampaguita
  Do NOT force Filipino words awkwardly
  Let cultural details appear naturally

IMAGE PROMPT QUALITY:
  Every prompt includes:
    Character name, type, appearance details
    Exact scene from that page
    Filipino cultural details where relevant
    Art style: "whimsical digital illustration,
    soft rounded shapes, flat pastel color palette,
    subtle traditional watercolor texture,
    children's book illustration style,
    warm and friendly atmosphere"
  Sticker prompts add:
    "isolated on pure white background for easy cutout"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## VISUAL DESIGN

Aesthetic: Bright & Playful Filipino Storybook
Bold, joyful, distinctly Filipino.
Warm, energetic, child-friendly. Not corporate.

CSS Variables:
  --sun-yellow:  #FFD63A
  --coral:       #FF6B6B
  --sky:         #4FC3F7
  --leaf:        #66BB6A
  --deep-blue:   #1A237E
  --warm-white:  #FFFDE7
  --cream:       #FFF8E1
  --earth:       #795548
  --muted:       #5D4037

Typography (Google Fonts CDN):
  Baloo 2    — headings, character names
  Nunito     — story text, body, translations
  Quicksand  — UI labels, buttons, badges
  Pacifico   — "Kwento Ko" logo ONLY

Design Elements:
  Rounded corners everywhere (16-24px)
  Bold color-block section headers
  CSS diamond/chevron border pattern on headers
  Sunburst CSS shape behind app logo
  Floating emoji animations on loading states
  Progress steps as colorful numbered circles
  Mobile-first (min-width: 375px)

Maintenance Ribbon (when Odoo is down):
  Full-width sticky top bar
  Background: amber #FFF3CD
  Border-bottom: 3px orange #FF9800
  Icon: ⚠️
  Text: "Kwento Ko is experiencing service issues.
         Full access available until [DATE TIME PH].
         We are working to restore service."
  Dismiss button (X) — ribbon reappears on refresh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## DOCKER COMPOSE

services:
  kwento-ko:
    build: ./backend
    ports:
      - "${PORT:-3000}:3000"
    env_file: .env
    volumes:
      - ./frontend:/app/frontend
      - ./data:/app/data
    restart: unless-stopped

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## BACKEND DOCKERFILE

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]

Note: Chromium installed in Alpine for Puppeteer.
Use puppeteer-core package, not puppeteer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## QUALITY REQUIREMENTS

Security:
  GEMINI_API_KEY, FAL_API_KEY, REPLICATE_API_KEY,
  OPENROUTER_API_KEY, ODOO passwords — never in
  frontend code, API responses, or browser requests
  JWT_SECRET never exposed to client
  Admin routes require separate admin auth check
  Promo codes validated server-side always

Reliability:
  All API responses: { data } or { error: "message" }
  AI malformed JSON: strip fences, re-parse,
    if still failing → return clean error
  Rate limit 429: "Sandali lang! Too many requests —
    please wait a moment and try again."
  Odoo sync failures: queue and retry silently,
    never block user-facing operations
  Puppeteer timeouts: 60s max, clean error on fail

Performance:
  SQLite counters checked before Odoo (fast path)
  Odoo sync is always async, never blocks response
  Tier cache in SQLite: 1-hour TTL
  Images stored as base64 in SQLite (simple)
    or URL reference (for external providers)

UX:
  Wizard state saved to localStorage on every change
  Refresh never loses progress mid-wizard
  Regenerate page replaces only that one card
  Image prompt format toggle: client-side only
  Library search: client-side filtering
  Copy buttons: work on all browsers incl. mobile Safari
  All exports: fully client-side except book compilation
  App usable at 375px minimum width
  Guest users: gentle non-blocking upgrade prompts
  Maintenance ribbon: visible but dismissible

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## README.md SECTIONS

1.  What is Kwento Ko?
    (text + prompts only for free; images & book
     compilation for Pro/Business)
2.  Prerequisites
    (Docker, Docker Compose, Gemini API key,
     Cloudflare Tunnel, Odoo instances)
3.  Setup & first run
4.  Filling in .env (guide for each EDIT_THIS field)
5.  Odoo configuration (what modules to enable,
    what API user needs what access)
6.  AI provider switching (how to change providers
    without restarting — via admin dashboard settings)
7.  Updating the frontend (no rebuild needed)
8.  Updating the backend
    (docker compose restart kwento-ko)
9.  Backing up stories (copy ./data/kwento.db)
10. Viewing logs (docker compose logs -f kwento-ko)
11. Getting API keys
    (Gemini, fal.ai, OpenRouter, Replicate, Ollama)
12. Cloudflare Tunnel setup
13. Moving to cloud VPS (Hetzner migration steps)
14. Admin dashboard usage guide
15. Tester account setup guide
