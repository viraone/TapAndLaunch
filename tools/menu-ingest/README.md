# Menu job (runs on your Mac, not in the cloud)

Reads restaurant menus into LiveBitesNow's own menu screen, for free, with a local model.

For each restaurant that has a website the job:
1. checks the site's `robots.txt` and skips the site if it asks bots to stay away;
2. opens the home page in a real headless browser (so menus built by JavaScript are read), finds the Menu page and opens it;
3. gives the page text to a local model in Ollama (default `qwen3.8:27b`) to turn into sections, dishes, prices and descriptions;
4. **throws away anything that isn't found on the page** (the model can't invent dishes), cleans prices, and rejects the whole
   menu if it is too small or too much of it can't be verified;
5. saves it. The app then shows it in its own menu screen. Restaurants with no saved menu fall back to showing their website.

It is polite: one site at a time, a pause between sites, no images or video downloaded, and it identifies itself as `LiveBitesMenuBot`.
Each restaurant is re-read at most every 14 days. Only the dishes, prices and short descriptions are stored (with the source page and the date);
the app says where the menu came from and that it may be out of date.

## One-time setup
1. `cd tools/menu-ingest && npm install` (already done on this Mac).
2. Ollama must be installed with a model: `ollama list` should show `qwen3.8:27b`.
3. To **save** results (not needed for dry runs) create `tools/menu-ingest/.env` with the LIVE database settings:
   ```
   SUPABASE_URL=https://<your live project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<the live project's service_role key>
   ```
   (Supabase dashboard → live project → Project Settings → API.) This file is git-ignored. The repo's `.env.local` points at a
   *development* database and is deliberately never used here.

## Try it first (saves nothing)
```
node run.mjs --names "taco del mar,gyro hut" --limit 5
```
Results go to `out/<id>.json` for you to read. A normal run on 20 restaurants takes 20 to 40 minutes.

## Save to the live database
Run after the app version with the menu screen is live:
```
node run.mjs --write --limit 20
```
Useful options: `--names "a,b"`, `--ids uuid,uuid`, `--force` (re-read even if recent), `--lat/--lng` (dry runs: which area),
`--max-minutes 180`, `--model qwen3.8:27b`.

## Every night (optional)
`./install-nightly.sh` turns on a 2:30 AM run (it keeps the Mac awake while it works and starts Ollama if needed);
`./install-nightly.sh remove` turns it off. Log: `~/Library/Logs/menu-ingest.log`. If the Mac is off, nothing breaks:
the app keeps showing the last saved menus.

## What it can't read
PDF menus and image-only menus (the app falls back to the restaurant's website for those), and sites whose `robots.txt` says no.
Prices are only as current as the restaurant's page.
