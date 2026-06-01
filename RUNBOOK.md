# MenuVision — Runbook

Day-to-day operating guide: how to start and stop the app, how the
pieces fit together, and what to check when something goes wrong.

---

## Starting and stopping

### Development (hot-reload, detailed errors)

```bash
npm run dev          # starts on http://localhost:3000
```

Stop with **Ctrl + C** in the same terminal.

### Production (local)

```bash
npm run build        # compile once
npm start            # serve the compiled output on http://localhost:3000
```

Stop with **Ctrl + C**.

### ⚠️ After any code change — full restart required

Leaving the dev server running across code changes causes stale `.next`
chunk errors (`Cannot find module './948.js'`). Always do a clean
restart after edits:

```bash
# 1. Kill any running Next.js process
pkill -9 -f "next"

# 2. Clear the build cache
rm -rf .next

# 3. Start fresh
npm run dev -- --port 3000
```

Then confirm it's up before opening the browser:

```bash
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
# should print 200
```

### Check the port is free before starting

```bash
lsof -ti:3000        # prints the PID using port 3000, blank if free
kill $(lsof -ti:3000)  # force-stop whatever is on 3000
```

### Vercel (deployed)

Vercel manages the process — there is no start/stop. Redeploy by
pushing to `main`:

```bash
git push             # triggers a Vercel build automatically
```

To roll back, use the Vercel dashboard → Deployments → Promote a
previous deployment.

---

## Architecture overview

```
Browser (mobile)
│
│  1. compress image client-side (≤1600 px, JPEG 88%)
│  2. navigator.geolocation → BigDataCloud (reverse geocode, no key)
│
└── Next.js App Router  (app/)
    │
    ├── page.tsx              root shell (server component)
    ├── components/
    │   ├── MenuUploader.tsx  orchestrates the full scan flow (client)
    │   ├── DishCard.tsx      per-dish card + photo carousel (client)
    │   ├── DishCardSkeleton  loading placeholder (server-renderable)
    │   └── LocationChip.tsx  geolocation UI chip (client)
    │
    ├── hooks/
    │   └── useLocation.ts    geolocation + reverse-geocode hook
    │
    ├── lib/
    │   ├── compress-image.ts  Canvas-based client resize utility
    │   └── rate-limit.ts      in-memory fixed-window limiter (server)
    │
    ├── types/
    │   └── menu.ts            shared Dish interface
    │
    └── api/
        ├── ocr/               POST  multipart image → raw text
        ├── parse-menu/        POST  raw text → Dish[]
        ├── dish-image/        GET   dish name → image URLs (cached)
        └── generate-image/    POST  dish name → b64 AI image (cached)
```

---

## Request flow — scanning a menu

```
User picks image
      │
      ▼
compressImage()          client-side Canvas resize (skips files < 400 KB)
      │
      ▼
POST /api/ocr            sends base64 to Google Cloud Vision
      │                  returns: { text: "..." }
      ▼
POST /api/parse-menu     sends OCR text + optional location to GPT-4o-mini
      │                  returns: { dishes: Dish[] }
      ▼
Dish cards rendered
      │
      ▼  (user taps "Show photos")
GET  /api/dish-image     SerpAPI Google Images → up to 3 thumbnail URLs
      │
      ├─ ≥ 2 URLs → show real photos  ("Real photos" label)
      │
      └─ < 2 URLs → POST /api/generate-image
                        GPT-image-1 → base64 PNG
                        ("AI-generated preview" label)
```

---

## External services and keys

| Service | Used for | Key env var | Where to get it |
|---|---|---|---|
| Google Cloud Vision | OCR text extraction | `GOOGLE_VISION_API_KEY` | GCP Console → APIs & Services → Credentials (enable Cloud Vision API first) |
| OpenAI | Menu parsing (GPT-4o-mini) + image generation (gpt-image-1) | `OPENAI_API_KEY` | platform.openai.com/api-keys |
| SerpAPI | Real food photos via Google Images | `SERP_API_KEY` | serpapi.com/manage-api-key |
| BigDataCloud | Reverse geocoding (lat/lng → city, country) | none | Free, no key, called client-side |

---

## API routes reference

| Route | Method | Input | Output | Timeout |
|---|---|---|---|---|
| `/api/ocr` | POST | `multipart/form-data` — field `image` (File) | `{ text }` | 30 s |
| `/api/parse-menu` | POST | JSON `{ text, location? }` | `{ dishes: Dish[] }` | 30 s |
| `/api/dish-image` | GET | `?name=<dish>` | `{ urls: string[] }` | 20 s |
| `/api/generate-image` | POST | JSON `{ name, description? }` | `{ b64_json }` | 60 s |

All routes return `{ error: string }` on failure and a `429` with
`Retry-After` when the rate limit is exceeded (10 req / min / IP,
fixed window).

---

## In-memory caches

`/api/dish-image` and `/api/generate-image` cache results in
module-level `Map`s keyed by lowercased dish name.

**What this means in practice:**

- Same dish name → instant response on the second request within a session
- **Process restart** (or Vercel cold start) → cache is empty again
- **Concurrent Vercel instances** → each has its own cache; no sharing

For production at scale, replace the Maps with a shared store
(Vercel KV, Upstash Redis) and key on a hash of the dish name.

---

## Rate limiting

Fixed-window: 10 requests per minute per IP **per route**.
Limits are independent — hitting `/api/ocr` 10 times does not
affect the user's `/api/parse-menu` budget.

The store is in-memory and per-process, so distributed deployments
do not share limits. Upgrade to an edge KV store for a global limit.

---

## Client-side persistence

The last successful scan is written to `localStorage` under the key
`menuvision_last_menu`. On page load, MenuUploader reads this key and
restores the success state immediately — no network call needed.

Clicking **"Scan another menu"** removes the key. The next page load
starts from scratch.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "No text detected in this image" | Photo is blurry, low-contrast, or not a menu | Retake with better lighting; ensure text is in frame |
| "No images found" from dish-image | SerpAPI returned no results for that dish name | Usually a foreign-language name — the AI fallback generates one instead |
| `/api/generate-image` times out on Vercel | `gpt-image-1` took > 60 s | Rare; retry. Upgrade to Vercel Pro (300 s) if it happens consistently |
| 429 Too Many Requests | 10 req/min limit hit | Wait 60 s; limit resets on the next window |
| Location shows "Detecting…" forever | Geolocation timed out (> 10 s) or device GPS off | Tap "Detecting…" to type a location manually |
| Location permission denied | User declined the browser prompt | Tap the chip to type a location manually; prompt can be re-enabled in browser site settings |
| Old dishes shown on refresh | `menuvision_last_menu` in localStorage | Tap "Scan another menu" to clear, or clear site data in browser settings |
| Camera button opens file picker instead of camera (desktop) | `capture="environment"` is ignored on desktop browsers | Expected — `capture` is a mobile-only hint |
