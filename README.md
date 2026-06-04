# MenuVision

Point your phone at a restaurant menu. MenuVision reads the text, identifies every dish, translates it, flags allergens, and shows you a picture of each one — all in a mobile-first web app.

## Features

- **OCR** — Google Cloud Vision extracts text from a photo or uploaded image
- **Menu parsing** — GPT-4o-mini structures the raw text into typed dish objects (name, translation, description, ingredients, price), streamed back line-by-line so dishes appear one at a time
- **Allergen detection** — ingredients are matched against a keyword map covering the EU "Big 14" allergens and flagged on each dish
- **Image source toggle** — choose how dish photos are sourced per scan:
  - **Search** — SerpAPI fetches real Google Images results per dish (falling back to AI generation if too few are found)
  - **AI** — `gpt-image-1` generates a food-photography preview for every dish, skipping search entirely
- **Client-side compression** — images are resized to ≤ 1600 px and re-encoded as JPEG before upload
- **Offline-resilient** — last scanned menu (and your image-source choice) is persisted in `localStorage`
- **Rate limiting** — 10 requests / minute / IP per API route (fixed window, in-memory)

## Local setup

### Prerequisites

- Node.js 18+
- npm 9+
- API keys for all three services (see below)

### Steps

```bash
git clone <your-repo-url>
cd menuvision
npm install
cp .env.local.example .env.local   # then fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` file in the project root (never commit it — it is already in `.gitignore`).

| Variable | Service | How to obtain |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials. Enable the **Cloud Vision API** on your project first. |
| `SERP_API_KEY` | SerpAPI | [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key) |

Example `.env.local`:

```
OPENAI_API_KEY=sk-...
GOOGLE_VISION_API_KEY=AIza...
SERP_API_KEY=...
```

## Deploy to Vercel

1. Push this repository to GitHub (or GitLab / Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In the Vercel project settings → **Environment Variables**, add the three variables above.
4. Click **Deploy**. Vercel auto-detects Next.js — no `vercel.json` needed.

> **Timeout note:** `/api/generate-image` has `maxDuration = 60` seconds. Image generation with `gpt-image-1` can occasionally take 30–50 s. The Vercel Hobby plan supports up to 60 s per function, which is usually sufficient. If you hit timeouts consistently, consider upgrading to Pro (300 s limit) or caching generated images in external storage.

## Architecture

### API routes

| Route | Method | Purpose | `maxDuration` |
|---|---|---|---|
| `/api/ocr` | POST | Multipart image → Google Vision text detection | 30 s |
| `/api/parse-menu` | POST | Raw OCR text → GPT-4o-mini structured dish list | 30 s |
| `/api/dish-image` | GET | Dish name → up to 6 SerpAPI image URLs | 20 s |
| `/api/generate-image` | POST | Dish name + description → gpt-image-1 b64 image | 60 s |

### In-memory caching

`/api/dish-image` and `/api/generate-image` cache results in a module-level `Map`. This makes repeated "Show photos" taps instant within a session. **On Vercel, each serverless function instance has its own memory**, so the cache does not persist across cold starts or concurrent instances. For production at scale, replace the Maps with a shared store such as Vercel KV or Upstash Redis.

### Rate limiting

Each route enforces a fixed-window limit of **10 requests / minute / IP** using a shared in-memory store (`app/lib/rate-limit.ts`). The same caveat applies: limits are per-instance, not global. For a distributed limit, use an edge KV store.

## License

Released under the [MIT License](LICENSE).
