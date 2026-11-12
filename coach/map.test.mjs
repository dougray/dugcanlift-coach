import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';

// Run from the repo root: node --test coach/*.test.mjs

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/* ---------------- the kit's bytes ---------------- */

// coach/map/ is dugcanlift-kit's map/ folder, with its web/ files beside the
// styles (the page loads map/map.js, and map.js adds map/maplibre-gl.css). The
// manifest is the kit's own, unedited: a line for "web/x" is checked against
// "map/x" here. Copy the kit's folder and manifest over together; never edit a
// file in it, and never rewrite a line by hand to make this pass.
const MAP = 'coach/map';
const manifest = readFileSync(`${MAP}/map-files.sha256`, 'utf8').trim().split('\n').map((line) => {
  const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
  assert.ok(m, `map-files.sha256 line is not "<sha256>  <path>": ${line}`);
  return { hash: m[1], listed: m[2], here: m[2].replace(/^web\//, '') };
});

const filesUnder = (dir, prefix = '') => readdirSync(dir).flatMap((name) => {
  const rel = prefix + name;
  return statSync(`${dir}/${name}`).isDirectory() ? filesUnder(`${dir}/${name}`, rel + '/') : [rel];
});

test("the map files are the kit's, byte for byte", () => {
  assert.ok(manifest.length > 250, 'the manifest lists the styles, fonts and web files');
  manifest.forEach(({ hash, here }) => {
    assert.equal(sha(readFileSync(`${MAP}/${here}`)), hash, `${MAP}/${here} does not match map-files.sha256`);
  });
});

test("the kit's tile-size fixture is shipped with the map files and listed in its manifest", () => {
  assert.ok(manifest.some((m) => m.listed === 'tile-size-sample.json'));
  assert.ok(readFileSync(`${MAP}/tile-size-sample.json`).length > 0);
});

test('nothing sits in coach/map that the kit manifest does not list', () => {
  const listed = new Set(manifest.map((m) => m.here));
  const extra = filesUnder(MAP).filter((f) => f !== 'map-files.sha256' && !listed.has(f));
  assert.deepEqual(extra, []);
});

test('all 256 glyph ranges are there, empty ones included', () => {
  const ranges = filesUnder(`${MAP}/fonts/Noto Sans Regular`);
  assert.equal(ranges.length, 256);
});

test('the vendored MapLibre is the pinned 5.24.0, a classic script', () => {
  const js = readFileSync(`${MAP}/maplibre-gl.js`);
  assert.equal(sha(js), '45a9b07a9189ce56054c620a947ccf41e291e58c95e9b61533b740aaa65ee5cb');
  assert.match(js.toString('utf8', 0, 300), /v5\.24\.0/);
});

test("MapLibre's licence text is shipped with it", () => {
  assert.match(readFileSync(`${MAP}/LICENSE-maplibre.txt`, 'utf8'), /Copyright \(c\) 2023, MapLibre contributors/);
  assert.match(readFileSync(`${MAP}/fonts/OFL.txt`, 'utf8'), /SIL OPEN FONT LICENSE/i);
});

/* ---------------- the service worker ---------------- */

const swSource = readFileSync('coach/sw.js', 'utf8');
const sw = (() => {
  const context = { self: { addEventListener() {}, location: { origin: 'https://www.dugcanlift.com' } } };
  vm.createContext(context);
  vm.runInContext(swSource + '\n;this.cachesToDelete = cachesToDelete; this.CACHE = CACHE; this.SHELL = SHELL; this.MAP_ASSETS = MAP_ASSETS;', context);
  return context;
})();

// Cache Storage is per origin, and www.dugcanlift.com serves LIFT at /lift/ as
// well as Coach at /coach/: Coach's service worker must never delete a cache
// that is LIFT's, least of all the streets a LIFT user downloaded.
test('the map tile cache survives an app update', () => {
  assert.deepEqual(
    sw.cachesToDelete(['coach-v43', 'coach-v44', 'coach-map-tiles'], 'coach-v44'),
    ['coach-v43']);
  assert.deepEqual(sw.cachesToDelete(['coach-map-tiles'], sw.CACHE), []);
});

test("an update deletes only Coach's own old shell caches, never LIFT's or anyone else's", () => {
  const keys = ['coach-v45', 'coach-v46', 'coach-map-tiles', sw.MAP_ASSETS, 'lift-v64', 'lift-map-tiles', 'other'];
  assert.deepEqual(sw.cachesToDelete(keys, 'coach-v46'), ['coach-v45']);
  assert.deepEqual(sw.cachesToDelete(['lift-v64', 'lift-map-tiles', 'lift-map-assets-45a9b07a'], sw.CACHE), []);
});

test("the engine's and glyphs' cache is named for the pinned engine, and an older one is pruned", () => {
  assert.equal(sw.MAP_ASSETS, `coach-map-assets-${sha(readFileSync(`${MAP}/maplibre-gl.js`)).slice(0, 8)}`);
  assert.deepEqual(
    sw.cachesToDelete(['coach-map-assets-deadbeef', sw.MAP_ASSETS, 'coach-map-tiles', sw.CACHE], sw.CACHE),
    ['coach-map-assets-deadbeef']);
  // a shell bump leaves the current assets cache alone
  assert.deepEqual(sw.cachesToDelete([sw.MAP_ASSETS, 'coach-v1'], sw.CACHE), ['coach-v1']);
});

test('the install bundle carries the map script, css, styles and license but not the engine or the glyphs', () => {
  ['map.js', 'maplibre-gl.css', 'style-light.json', 'style-dark.json', 'LICENSE-maplibre.txt']
    .forEach((f) => assert.ok(sw.SHELL.includes(`/coach/map/${f}`), f));
  assert.ok(!sw.SHELL.includes('/coach/map/maplibre-gl.js'), 'the engine is fetched on first use and kept');
  assert.ok(!sw.SHELL.some((u) => u.endsWith('.pbf')), 'glyph ranges are fetched on first use and kept');
  assert.ok(sw.SHELL.every((u) => !u.includes('/fonts/Noto')));
});

test('map files outside the install bundle are kept in the map-owned cache, and a miss is a 404', () => {
  assert.match(swSource, /caches\.open\(MAP_ASSETS\)/);
  assert.match(swSource, /status: 404/);
  assert.match(swSource, /\/coach\/map\//);
});

/* ---------------- who may reach beyond dugcanlift.com ---------------- */

// Only map.js asks OpenFreeMap for anything, and only from a download the
// coach starts. The vendored MapLibre contains fetch( and XMLHttpRequest by
// nature; it is exempt by its pinned hash, and nothing else is.
const ENGINE_SHA = '45a9b07a9189ce56054c620a947ccf41e291e58c95e9b61533b740aaa65ee5cb';
const scripts = [
  ...readdirSync('coach').filter((f) => f.endsWith('.js')).map((f) => `coach/${f}`),
  ...readdirSync(MAP).filter((f) => f.endsWith('.js')).map((f) => `${MAP}/${f}`),
];

test('only map.js names the tile server', () => {
  scripts.filter((f) => f !== `${MAP}/map.js`).forEach((f) => {
    const bytes = readFileSync(f);
    if (sha(bytes) === ENGINE_SHA) return;
    assert.ok(!/openfreemap/i.test(bytes.toString('utf8')), `${f} names the tile server`);
  });
  assert.ok(/openfreemap/i.test(readFileSync(`${MAP}/map.js`, 'utf8')));
});

test('no other script opens a socket, an XHR, a beacon or an absolute-address fetch', () => {
  const banned = /XMLHttpRequest|sendBeacon|new WebSocket|new EventSource|fetch\(\s*['"`]https?:/;
  scripts.forEach((f) => {
    const bytes = readFileSync(f);
    if (sha(bytes) === ENGINE_SHA || f === `${MAP}/map.js`) return;
    assert.ok(!banned.test(bytes.toString('utf8')), `${f} reaches beyond the app's own files`);
  });
});

test('the exemption is the pinned engine and no other file', () => {
  const exempt = scripts.filter((f) => sha(readFileSync(f)) === ENGINE_SHA);
  assert.deepEqual(exempt, [`${MAP}/maplibre-gl.js`]);
});

/* ---------------- the page ---------------- */

const html = readFileSync('coach/index.html', 'utf8');
const app = readFileSync('coach/app.js', 'utf8');

test('map.js loads before app.js, and the engine is not a script tag', () => {
  const at = (s) => html.indexOf(s);
  assert.ok(at('src="map/map.js"') > 0);
  assert.ok(at('src="map/map.js"') < at('src="app.js"'));
  assert.ok(!html.includes('maplibre-gl.js'), 'the engine loads on first use, not on every visit');
});

test('Coach configures its own cache, storage key and folder', () => {
  assert.match(app, /LiftMap\.configure\(\{\s*cachePrefix: 'coach-map-',\s*storageKey: 'coach\.mapAreas',\s*base: '\/coach\/map\/'/);
});

test("the route card offers the client's-route download in the kit's words", () => {
  assert.match(app, /LiftMap\.copy\.forThisRoute/);
  assert.ok(app.includes("This asks for the area around your client's route."));
  assert.match(app, /LiftMap\.mount\(/);
  assert.match(app, /fallback:/);
  assert.match(app, /LiftMap\.planForRoute\(/);
});

test('Connect has a Maps panel before This device', () => {
  const maps = html.indexOf('id="maps-list"');
  assert.ok(maps > 0);
  assert.ok(maps < html.indexOf('<h2>This device</h2>'));
});

test('licences for the map are credited on the page and in NOTICE', () => {
  ['MapLibre', 'OpenStreetMap', 'OpenFreeMap', 'Noto Sans'].forEach((name) => {
    assert.ok(html.includes(name), `index.html credits ${name}`);
    assert.ok(readFileSync('NOTICE', 'utf8').includes(name), `NOTICE credits ${name}`);
  });
});

/* ---------------- the download offer's decision ---------------- */

// street-offer.js is the one place that decides whether the route card offers a
// download, shows a download already running, or says nothing. It is a pure
// function because the rule lives in no view's state, and because getting it
// wrong either offers a map for a route that cannot draw one or starts a second
// download of the same route while the first is running unseen.
const offerShim = { window: {} };
new Function('window', readFileSync('coach/street-offer.js', 'utf8')).call(offerShim, offerShim.window);
const decide = offerShim.window.CoachStreetOffer.decide;

test('a route that cannot draw a map is never offered a download', () => {
  assert.equal(decide({ pointCount: 0, covered: false, running: false }), 'none');
  assert.equal(decide({ pointCount: 1, covered: false, running: false }), 'none');
  assert.equal(decide({ pointCount: 1, covered: false, running: true }), 'none');
});

test('an uncovered route with two or more points is offered the button', () => {
  assert.equal(decide({ pointCount: 2, covered: false, running: false }), 'button');
});

test('a covered route is offered nothing', () => {
  assert.equal(decide({ pointCount: 50, covered: true, running: false }), 'none');
});

test('while a download of this route runs, the sheet stays and the button is never offered again', () => {
  assert.equal(decide({ pointCount: 50, covered: false, running: true }), 'sheet');
  // finished a moment before the sheet closes: it is still the sheet's to close
  assert.equal(decide({ pointCount: 50, covered: true, running: true }), 'sheet');
});

test('the card hands the decision to it and keeps a running sheet across a re-render', () => {
  assert.match(app, /CoachStreetOffer\.decide\(/);
  assert.match(app, /streetRuns\.get\(key\)/);
  assert.ok(html.indexOf('src="street-offer.js"') > 0);
  assert.ok(html.indexOf('src="street-offer.js"') < html.indexOf('src="app.js"'));
  assert.ok(sw.SHELL.includes('/coach/street-offer.js'));
});
