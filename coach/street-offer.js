/* What the route card says about downloading its streets.
 *
 * A rule with no view in it, so it can be tested: 'none' (nothing to say),
 * 'button' (offer the download) or 'sheet' (a download of this route is
 * already running, so show it rather than offer a second one). A route with
 * fewer than two points cannot draw a map, so it is never offered one. */
(function (global) {
  'use strict';

  function decide(input) {
    if (!(input.pointCount >= 2)) return 'none';
    if (input.running) return 'sheet';
    if (input.covered) return 'none';
    return 'button';
  }

  global.CoachStreetOffer = { decide: decide };
})(typeof window !== 'undefined' ? window : globalThis);
