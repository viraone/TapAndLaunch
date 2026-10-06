# FitnessNav class reader (runs on your Mac, every night at 10 PM)

FitnessNav (fitnessnav.tapandlaunch.com) shows every Pilates, yoga, spin, lifting and climbing class at nearby studios
on one page, by day. Google has no class schedules, so this job reads each studio's own schedule page:

1. finds the schedule (the studio's own links, common addresses like `/schedule`, booking widgets inside frames),
   preferring the link named after the studio's neighborhood (chains list every location);
2. opens it in a headless browser, clicks through day tabs ("Mon 5" … "Sat 10") so one-day-at-a-time widgets give the week;
3. has the local model (Ollama, `qwen3.8:27b`) list the classes: date, start/end, name, instructor, spots;
4. keeps only classes whose name and start time appear on the page;
5. sorts each class into a type (`classify.mjs`) and marks online ones;
6. writes `out/`, rebuilds a preview page (`fitnessnav.html`), and saves to the live database when `.env` is set (`save.mjs`).

Robots.txt is respected (studios whose booking site says no, like Vagaro, are skipped). Nothing here costs money.

## Studios
`studios.json`: name, kind, website, address, neighborhood, coordinates. `schedule` pins the schedule page for a chain
whose pages don't say which location they show (CorePower: the generic page silently showed Bellevue). Check a new
chain's schedule against the studio's street address before trusting it.

## Run it
```
npm install
node read.mjs studios.json out            # all studios (30-45 min); --only "maven" for one
node gen.mjs .                            # preview page from out/
node save.mjs out                         # to the live database (needs .env)
```
`.env` (git-ignored): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (live project) and `FITNESSNAV_APP_ID`.

## Every night
`./install-daily.sh` copies the job to `~/.fitnessnav-job` (macOS won't let background jobs read ~/Desktop) and runs it
at 10:00 PM. Run it again after changing anything here. Log: `~/Library/Logs/fitnessnav.log`. `./install-daily.sh remove` turns it off.
To pause the nightly run, write a date (YYYY-MM-DD) to `~/.fitnessnav-job/skip-until`: the job skips nights before that day,
then runs again and removes the file. `launchctl kickstart gui/$(id -u)/com.tapandlaunch.fitnessnav` starts a run by hand.

## Known gaps
Wix booking calendars (Seed Pilates) aren't clicked through yet; a studio whose schedule shows one day with no day tabs
(TruFusion) gives one day; climbing gyms' schedules (Bouldering Project, Momentum) weren't found yet.
