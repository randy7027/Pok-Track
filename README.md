# Card Price Watch

Watches a list of Pokemon cards and pushes a notification to your phone when
one hits a price you set, dips a chosen percentage below its recent average,
or reaches a new low since you started tracking it. Checks run automatically
once a day via Vercel Cron, plus you can trigger a check manually from the
app.

Prices come from [pokemontcg.io](https://pokemontcg.io), which mirrors real
TCGPlayer (hourly) and CardMarket (daily) pricing — there's no simple public
way to query TCGPlayer directly, so this is the practical route.

**Honest limitation:** no free source has true historical all-time-low data.
"New low" here means the lowest price this app has observed since you added
the card — it gets more meaningful the longer you track a card, not from day one.

Everything below can be done from your phone's browser — no computer needed.

## What you'll set up

1. A GitHub repo (holds the code)
2. A Vercel project (runs it, deployed from the repo)
3. A Redis database from the Vercel Marketplace (stores your watchlist — free)
4. An ntfy topic (delivers the push notification — free, no account)

## 1. Put this code on GitHub

1. Go to [github.com](https://github.com) and sign in (or create an account).
2. Create a new repository (e.g. `card-price-watch`), public or private, no
   need to add a README/gitignore when prompted.
3. On the new repo's page, use **Add file → Upload files** and upload every
   file in this project, keeping the folder structure (`api/`, `lib/`,
   `public/`, plus `package.json` and `vercel.json` at the root). GitHub's
   uploader preserves folders if you drag them in together.
4. Commit the upload.

## 2. Deploy it on Vercel

1. Go to [vercel.com](https://vercel.com), sign in with your GitHub account.
2. **Add New → Project**, select the repo you just created, click **Deploy**.
   It'll fail on the first deploy — that's expected, it needs the env vars
   below first.

## 3. Add a Redis database

Vercel's own KV product was retired in favor of the Marketplace, so:

1. In your Vercel project, go to the **Storage** tab.
2. **Create Database → Redis** (Upstash is the usual provider) and follow the
   prompts. It's free at this scale.
3. Connect it to your project when asked — this automatically adds Redis
   credentials as environment variables.
4. Open **Settings → Environment Variables** and check what names it added.
   If they're not already called `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`, add two more variables with exactly those
   names, copying in the same values (that's what the code reads).

## 4. Set up push notifications

1. Install the **ntfy** app from the iOS App Store.
2. In the app, subscribe to a topic — pick something long and specific to
   you, not a guessable word, since public ntfy topics aren't
   password-protected (e.g. `randy-card-alerts-8x2k`).
3. Back in Vercel → **Settings → Environment Variables**, add:
   - `NTFY_TOPIC` — the exact topic name you chose
4. Test it anytime by running: `curl -d "test" https://ntfy.sh/your-topic-name`
   from any device — you should get a phone notification within seconds.

## 5. Redeploy

Back in Vercel → **Deployments**, re-run the deploy (or push any small change
to GitHub, which auto-deploys). Once it succeeds, open the deployment URL —
that's your app.

## 6. Optional: a pokemontcg.io API key

The app works without one at a lower rate limit, which is plenty for a
personal watchlist. If you hit limits, get a free key at
[dev.pokemontcg.io](https://dev.pokemontcg.io) and add it as
`POKEMONTCG_API_KEY` in Vercel's environment variables.

## Adjusting the daily check time

`vercel.json` sets the cron to `0 13 * * *` (1pm UTC). Vercel's free tier
caps cron jobs at once per day and only guarantees it fires sometime within
that UTC hour, not on the minute. Edit the schedule string and push the
change to GitHub to adjust it.

## Using it

Open the deployed URL, search for a card, tap a result, set a target price
and/or dip percentage and/or "alert on new low," then tap **Track this
card**. Use **Check now** anytime for an on-demand check instead of waiting
for the daily run.
