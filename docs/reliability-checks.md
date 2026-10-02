# Offline reliability checks

Build and verify the extension without a signed-in study session:

```sh
npm ci
npm test
```

The tests execute the compiled Manifest V3 background script with a Chrome API
fixture. They verify that history uses the same local storage as the popup,
concurrent events retain both records, a reserved event is logged once, and the
30-minute pause survives a fresh service worker through persisted state and an
alarm. The pause never automatically re-enables reservation. The manifest also
declares `offscreen`, required by the existing notification audio implementation.

This is local reliability evidence. Real notification delivery, audio playback,
Chrome suspension and platform responses need manual browser validation. These
checks do not establish account safety, permission to automate research tasks,
or protection against a platform ban. No study was accepted or submitted to run
these tests.
