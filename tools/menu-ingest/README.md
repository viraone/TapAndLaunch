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
Useful options: `--names "a,b"`, `--ids uuid,uuid`, `--force` (re-read even if recent), `--lat/--lng` (dry runs: which area), `--near` (with --lat/--lng and --write: only restaurants within ~2.5 miles of that point),
`--max-minutes 180`, `--model qwen3.8:27b`.

## Every day at 10 AM (optional)
`./install-nightly.sh` turns on a 10:00 AM daily run (change `RUN_HOUR` / `RUN_MINUTE` at the top of that script to move it) (it keeps the Mac awake while it works and starts Ollama if needed).
macOS won't let a background job read `~/Desktop`, so the installer copies the job to `~/.livebites-menu-job` and the schedule
runs it from there. **Run `./install-nightly.sh` again after changing anything in this folder** (it re-copies the files).
`./install-nightly.sh remove` turns it off. Log: `~/Library/Logs/menu-ingest.log`. If the Mac is off, nothing breaks:
the app keeps showing the last saved menus.

## Menus that are PDFs or pictures
If the page has no menu text, the job tries the menu's PDF (text read straight from the file), then pictures of the menu:
it opens the page with images, takes the big ones (up to 6), has the same local model (it can see) copy the words off each,
and reads that copy into dishes the same way as page text, still throwing away any dish not found in the copy.
Menus read from pictures are marked `fromPhoto` and the app says so ("a price can be misread from a photo"). Slower (about
2 to 3 minutes a restaurant). `--no-photos` turns it off. Check a few against the real menu before trusting a new site.

## Happy hour
The same pass also reads **happy hours** for the app's "Happy Hour" button. It reuses the pages already opened for the menu (plus the
site's own "Happy Hour" link if it has one). A page that doesn't say "happy hour" never reaches the model. Otherwise the model pulls out
days, start/end times, the deal wording and the exact sentence it read them from, and **a happy hour is kept only if that sentence is really on the page,
its times are written in that sentence, its days make sense, and the length is believable**. Deal wording not found on the page is dropped.
Saved to `food_places.happy_hour` (migration 0026, apply it to the live database **before** running `--write` or re-running `install-nightly.sh`,
or the job's restaurant query fails). Status per restaurant: `ok`, `none`, `unclear` (mentioned but nothing passed the checks) or `error`;
a failure never replaces a good saved happy hour. Dry runs print `happy hour: …` per restaurant and put it in `out/<id>.json`.
Check a few against the real page before trusting a new site: "not during special events" style small print is not captured.

## What it can't read
Menus that are only pictures the model can't read well (very stylised, tiny or tall images), and sites whose `robots.txt` says no.
Prices are only as current as the restaurant's page.
