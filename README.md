# LIFT Coach

A dashboard for trainers whose clients use LIFT. Clients send their training and
eating from the app; this collates it into a roster you can read on a Monday
morning and tell at a glance who has gone quiet.

There is no server, no account, and no sign-up — for you or for them.

**Live at [dugcanlift.com/coach](https://www.dugcanlift.com/coach/).** Free, and
licensed [Apache 2.0](LICENSE).

## How a log gets here

```
client's phone            their email app            your inbox              here
  "Send to Coach"  ──▶  opens pre-filled  ──▶  "LIFT log from …"  ──▶  tap the button
```

The log rides inside the link, in the fragment after the `#`. Browsers never
transmit a fragment to the server, so although this page is served from GitHub
Pages, the training data itself goes phone → mail provider → your browser and
dugcanlift.com never sees it. What lands here stays in this browser's
`localStorage`, on this device.

That also means: **clearing site data deletes your roster.** Connect → *Save a
backup file* exists for exactly that reason.

The wire format is [SHARE-FORMAT.md](coach/SHARE-FORMAT.md), shared by all four
LIFT clients. Change it in one and you change it in four. The backup file the
apps write is a different thing again — that one is
[BACKUP-FORMAT.md](coach/BACKUP-FORMAT.md), and plans going the other way are
[PLAN-FORMAT.md](coach/PLAN-FORMAT.md).

## What it shows

**Roster** — everyone you coach, quietest first, with sessions, sets, volume
against last week, average calories against target, and how often protein
landed. Anyone silent for a week floats to the top with a banner.

**Client** — week-by-week table, training volume, calories and protein against
goal, bodyweight trend, per-lift estimated 1RM progression, **Booked** — the
week you sent against the week they logged — and every session expandable down
to the individual set.

Booked counts and never grades. It says a day was booked and whether one was
logged, puts the sets you asked for above the sets that came back, and stops:
no score, no percentage, no colour on an absence, nothing carried across weeks
and nothing comparing one client to another. The words are *not logged*, never
"missed" — a client may have trained and not sent, been ill, or been told to
rest, and Coach cannot tell those apart. A day past the end of the window they
sent reads *outside the log they sent* instead, so the first is never claimed
wrongly. It needs a plan sent from this device after the feature shipped; plans
sent before it cannot be reconstructed and are simply absent.

**Connect** — the invite to send a client, and backup/restore.

**Cook** — recipes you write, a week built for one client, the shopping
list that falls out of it, and the Road Food items you are happy with for that
client — picks that ride in the same link and sit at the top of their list on
the road. Sends as a link the same way a log arrives, in the
opposite direction: the plan rides in the fragment, so dugcanlift.com never
sees it either. A plan is addressed to one client and their app refuses one
meant for someone else.

A recipe gets into Cook four ways: written by hand, copied from the bundled
catalogue, pasted as text, or sent from a recipe website with the **Send to
Coach** bookmarklet (Cook → *Send recipes from your browser*). See "Recipe
links" below.

**Train** — workout templates, and the client's week they are booked into.
*Print or save as PDF* under the send buttons prints that week for a client
who wants it on paper: the booked days, each workout, and each exercise read
as its card reads it, through the browser's own print dialog, which offers
Save as PDF. The lines are Coach iPhone's and Coach Android's, in their order
(`printout.js`); change them in all three or in none. Printing records
nothing — a printout is not a plan the client's app received.

## Setting a client up

Once, per client. Connect → fill in your name and the address logs should come
to → *Copy invite*. They put your address into LIFT's Coach card, and from then
on it is one tap on their end.

A client who reinstalls LIFT gets a new id and arrives as a second person in the
roster. Remove the stale one; the history you already have from them stays.

## Layout

The app lives in `coach/`, not at the repo root. That is deliberate: `sw.js`,
`manifest.webmanifest` and the shell list all use absolute `/coach/…` paths, and
the app is served from a `/coach/` subpath in production. Keeping the same
subpath here means local development and production resolve identically, and
deploying is a straight directory copy with nothing rewritten.

## Running it locally

Static files, no build. Serve the repo root:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/coach/`. The service worker caches the shell,
so bump `CACHE` in `sw.js` whenever a shell file changes or browsers keep
serving the old one.

## Deployment

This repo is the source of truth. The files are served at
`https://www.dugcanlift.com/coach/` by copying `coach/` into the
`dugcanlift-site` repo, which GitHub Pages builds.

```bash
./deploy.sh --dry-run    # see what would change
./deploy.sh              # copy, commit, push
```

It runs from your machine over SSH with the same key every other push to the
site has used. There is no CI job and no token stored on GitHub — one less
credential to rotate, and one less thing to go quiet when it expires.

It expects the site checked out at `~/Projects/dugcanlift-site`; set
`SITE_REPO` if it lives elsewhere. It refuses to run if the site's `coach/` has
uncommitted changes, because the copy deletes.

**That URL cannot move.** Three things are pinned to it:

- `CoachShare.coachURL` is compiled into shipped LIFT builds on both platforms,
  so every share link already in someone's inbox points at it.
- The PWA's `scope` and `start_url` are `/coach/`, and installed copies are
  installed against that origin.
- A coach's entire roster lives in `localStorage` for the origin
  `www.dugcanlift.com`. Serving from a different origin does not migrate it —
  it is simply gone, and every coach would have to restore from a backup file
  they may not have made.

Moving the source here changes nothing a user can see. That is the point.

## Contributing

The wire format is the sharp edge: `SHARE-FORMAT.md` is implemented by four
clients, and all of them must emit identical bytes. Change it in one and you
change it in four — bump the version, update the spec, and ship the clients
together.

The ingredient parser (`coach/parser.js`) is the other one. It exists four
times -- here, LIFT web's `app.js`, and the iOS and Android kits -- and all four
must read the same line the same way. `coach/fixtures/ingredient-lines.json` is
`dugcanlift-kit/data/ingredient-lines.json`, the case table every one of them
is tested against, written by hand from the rules in that repo's
`data/README.md`; `parser.test.mjs` runs it and checks the copy against
`ingredient-lines.sha256`. Change a rule there first, then all four parsers, and
copy both files over together. Never edit them here, and never regenerate them
from this parser.

## Bundled data

Five datasets ship with the app and are read offline, so the lookups work in
a kitchen or a gym with no signal.

| File | Rows | Size | Source |
|---|---|---|---|
| `coach/exercises.json` | 873 | 31 KB | [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public domain |
| `coach/foods.json` | 7,793 | 718 KB (166 KB gzipped) | USDA FoodData Central, SR Legacy — public domain |
| `coach/road-food.json` | 13 chains, 22 snacks | 55 KB | `dugcanlift-kit/data/road-food.json`, curated by hand |
| `coach/recipes.json` | 622 recipes | 1.0 MB (200 KB gzipped) | `dugcanlift-kit/data/recipes.json`, exported from the kit's `recipes.db` |
| `coach/bookmarklets.json` | 4 bookmarklets | 5 KB | `dugcanlift-kit/bookmarklet/bookmarklets.json`, built from `send-recipe.js` |

`road-food.json` is a verbatim copy of `dugcanlift-kit/data/road-food.json`,
the file LIFT bundles too — item ids are the contract road picks travel on, so
the two copies must not drift. Edit it in the kit and copy it here; never here
alone. It is fetched the first time the Road section is opened and cached from
then on, which means a new copy needs a `CACHE` bump in `sw.js`.

That used to be prose and nothing more. `road-food.sha256` is the kit's
checksum of those bytes, copied across with the JSON, and `road-picks.test.mjs`
hashes the file and asserts it matches — the tests either side of it check what
the data *means*, and pass perfectly well on a copy several chains behind, so
nothing else here would ever report one.

**When that test fails**, copy `road-food.json` *and* `road-food.sha256` from
`dugcanlift-kit/data/` over together, and bump `CACHE` in `sw.js`. Never edit
either file here, and never re-write the checksum by hand to make the test pass:
the kit writes it with `node data/validate-road-food.mjs --write-checksum`, and
the other four app repos pin the same one, so a hand-written hash only moves the
failure somewhere further away.

A chain in that file carries two dates: `checkedOn`, the day a person read its
chart, and the optional `publishedOn`, the date the document states about
itself (`"2021-03-29"`, or `"2022-11"` where the chart names only a month).
Cook → Road says both on the chain's card, as Coach iPhone does: "Published Nov
2022 · checked Sep 20, 2026", in the reader's locale, a month-only date printed
only to the month, and a value that is neither shape left out with its clause
(never "Invalid Date"). A chain with no `publishedOn` reads "Checked …" alone.
Coach does not warn — LIFT warns from `publishedOn`, and no Coach build says
anything about staleness — so the line gains a clause in all three Coach builds
or in none. A copy that lost the field here would be a copy that had drifted;
`road-picks.test.mjs` pins the field and `CoachRoadPicks.dateLine`.

The client page's charts put a few dates under each line ("Oct 4 · Oct 13 ·
Oct 22 · Oct 31"), chosen by `chart-dates.js`: each label under its own point,
from the local day key, in the reader's locale, with the year only when the
chart crosses one, and fewer labels rather than overlapping ones on a narrow
screen. `chart-dates.test.mjs` pins it. Bodyweight and estimated 1RM are fitted
to their values rather than drawn from zero; volume and calories start at zero,
because half as much has to look like half as much.

`foods.json` is deliberately **not** in the service worker's install bundle;
718 KB is not something to spend before someone has asked for it. It is cached
the first time it is actually used, which is what makes the lookup work offline
without making every install pay for it.

Both are derived files. `foods.json` is a verbatim copy of `lift/foods.json` in
the dugcanlift-site repo, which is its source of truth: it is built there by
`scripts/build_foods_json.py` (per 100 g: the five macros, then saturated fat,
sugar and sodium, null where USDA has no value). Rebuild it there and copy it
here; the generator is deliberately not duplicated in this repo. The row shape
is documented at the top of `foods.js`. For the exercises, take the upstream
database and keep only what `exercises.json` carries.

A pasted or typed recipe is costed against USDA, and anything that cannot be
weighed is reported as uncosted rather than guessed at.

`recipes.json` is the starter catalogue Cook → *From the catalogue* browses,
the same 622 recipes Coach iPhone reads out of `recipes.db`, and a port of that
screen (`recipe-catalogue.js`). It is a verbatim copy of
`dugcanlift-kit/data/recipes.json`, which the kit's
`Tools/export_recipes_json.py` derives from the database, pinned by
`recipes.sha256` exactly as `road-food.json` is: `recipe-catalogue.test.mjs`
hashes the bytes. Copy both files together, bump `CACHE`, never edit either
here and never write the checksum by hand. Like `foods.json` it is not in the
install bundle: it is fetched from this origin the first time the catalogue is
opened and cached from then on.

Nothing in it is re-costed here; its build already priced what converts to a
weight and says in `nutritionNote` what it could not. A recipe whose source
states no yield has a null `servings` and whole-dish totals, and the coach picks
how many it serves on Add. Every recipe carries its own `license` and
`attribution` (CC BY-SA 4.0 or public domain), shown with it, and kept on the
library copy as `sourceAuthor`. **Attribution does not travel on the plan
wire** — PLAN-FORMAT has no field for it — so a CC BY-SA recipe sent to a
client arrives uncredited. That is the iPhone's open question too, and it needs
a wire-format decision across all the clients, not a patch here.

## Recipe links

The **Send to Coach** bookmarklet reads a recipe page the coach already has
open and comes here with the page's address and the raw text of its
schema.org JSON-LD blocks in the fragment:

```
https://www.dugcanlift.com/coach/#r1<base64url(deflate-raw(JSON))>
JSON = {"v":1,"url":"<page address>","jsonld":["<block text>", ...]}
```

Coach never requests the page, and the fragment never reaches a server. The
format, the bookmarklet's source and the reference decoder are
`dugcanlift-kit/bookmarklet/`; its README's "Rules every build follows" bind
this app too. `recipe-link.js` is the port of the decoder, with the same
refusals, and `recipe-link.test.mjs` checks it against the kit's fixture pair
(`coach/fixtures/recipe-link.txt` and `recipe-link-expected.json`, written by
the bookmarklet itself; never regenerate them here).

A log link's fragment opens with its version number (`1z`, `1u`) and a recipe
link's with `r1`, and `consumeAny` in `app.js` routes on that before either
decoder runs. Like a log link, a recipe link is stripped from the address with
`history.replaceState` as soon as it is read. The blocks go to
`recipeFromJsonLdPayload` in `recipe-import.js`, unchanged (LIFT web copies
that file whole), and the recipe opens in the recipe form for the coach to
check: servings only from the page's own yield, the page's nutrition kept
and marked an estimate, the page address kept as the recipe's `sourceUrl`.
Nothing is saved until Save. A link that cannot be read, or a page with no
recipe in it, says so and fills nothing.

`bookmarklets.json` and `bookmarklets.sha256` are verbatim copies of the
kit's, pinned the way `recipes.json` is: `recipe-link.test.mjs` hashes the
bytes. Copy both together, bump `CACHE`, and never edit either here. Cook →
*Send recipes from your browser* shows its `coachWeb` entry, to drag to a
bookmarks bar or copy into a phone bookmark. It is small enough to sit in the
service worker's install bundle.

## Street maps

A client's last route is drawn over streets once the coach has downloaded the
area around it: **Download streets for this route**, under the route, or
Connect → *Maps* to update or delete what is saved. The module is
dugcanlift-kit's `map/` folder, shared with LIFT web, copied byte for byte into
`coach/map/` (`map.js`, MapLibre GL JS 5.24.0, the two styles, the Noto Sans
glyph ranges and their licenses). `coach/map/map-files.sha256` is the kit's
manifest, and `map.test.mjs` hashes every file against it. When the kit
changes, copy its `map/` folder over with the new manifest and bump `CACHE`;
never edit a file in `coach/map/`, and never rewrite a manifest line by hand.

The one request to a map server is a download the coach starts, from `map.js`
to OpenFreeMap, and the sheet says so first. Looking at a map asks for nothing
but this app's own files: tiles come out of Cache Storage (`coach-map-tiles`),
which the service worker keeps across updates. The 1 MB MapLibre script is not
in the page or the install bundle; `app.js` loads it the first time a downloaded
area could be shown, and the service worker keeps it. Only `map.js` may name the
tile server, and only the pinned `maplibre-gl.js` (by hash) may contain `fetch(`
or `XMLHttpRequest`; `map.test.mjs` checks both.

## License

[Apache License 2.0](LICENSE), with an explicit patent grant. Recipes keep their
own license and attribution (see [NOTICE](NOTICE)).

Same license as the LIFT apps
([iOS](https://github.com/dougray/dugcanlift-lift-ios),
[Android](https://github.com/dougray/dugcanlift-lift)).

## Browser support

Decoding a link needs `DecompressionStream`, which means Safari 16.4+, Chrome
103+, or anything newer. Older browsers get a clear message rather than a blank
screen. Senders that lack `CompressionStream` fall back to uncompressed links,
which this reads too.
