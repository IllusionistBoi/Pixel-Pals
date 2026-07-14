# Current task: Improve title-screen readability and arcade presentation

- [x] Audit the supplied screenshot and current title-screen implementation.
- [x] Identify the low-contrast, alignment, crowding, and narrow-layout root causes.
- [x] Implement and consolidate the vintage arcade readability and motion pass.
- [x] Fix narrow marquee, roster, title-control, deck-label, and coin-target issues.
- [x] Rebuild the self-contained `dist/pixel-pals.html`.
- [x] Verify source syntax, accessibility, motion, layout budgets, and bundle parity.
- [x] Review the final diff for simplicity, accessibility, and regressions.
- [x] Capture current title-screen screenshots for the README.
- [x] Refresh the README with the visual walkthrough and static-host deployment notes.
- [x] Deploy the current branch to Vercel and record the production URL.
- [x] Commit the UI, bundle, README, and screenshot updates.

## Verification

- [x] HTML is balanced; 32 IDs are unique; 19 buttons are labelled.
- [x] All 11 source scripts and the bundled inline script parse.
- [x] Contrast ranges from 7.22:1 to 18.30:1 for title copy and ghost labels.
- [x] Six viewport budgets pass from 933x591 down to 320x480.
- [x] All 13 animated selectors have OS and stored-preference motion opt-outs.
- [x] The offline bundle exactly matches source and contains no external dependencies.
- [x] Live browser launch was attempted but denied by the managed Windows policy; deterministic source, layout, and bundle checks were used instead.

## Documentation follow-up

- [x] Fresh desktop and responsive screenshots captured with Playwright.
- [x] README now documents GitHub Pages and Vercel deployment paths.
- [x] Confirm the Vercel account is authenticated and the production deployment is ready.
