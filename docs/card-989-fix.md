# Card #989: duplicate patient overwrite fix

A new-patient submission must be rejected consistently by Save Patient and Save record. Vaccination entry for an explicitly selected patient must never edit the saved profile.

## Changes

- Block known duplicate new patients before continuing to vaccination.
- Validate the full record before any database write and reject new-patient duplicate identities on the records endpoint (including case and outer whitespace variations).
- Require an existing workspace patient ID and matching identity when adding vaccination history to an existing patient.
- Reject stale or changed contact/visit/coverage values with `PATIENT_DETAILS_CHANGED`; use Edit patient, then reselect the patient to load current values.
- Save new profiles, vaccinations, and original accuracy snapshots in one D1 batch transaction. Existing profile data and historical records are never updated by vaccination entry.
- Retain the classroom 30-day spacing rule and separate accuracy-test record workflow.

## Validation

Use Node.js 22.13+ and the locked dependencies. Run:

```sh
pnpm run test:card-989
pnpm exec tsc --noEmit
pnpm exec vite build --config github-pages/vite.config.ts
```

The new regression suite runs actual route handlers and SQL in a temporary SQLite database with fictional data. It covers alternate-path duplicates, unchanged profiles/history/snapshots on rejection, required fields, stale edits, missing selection, same-day/29-day/exactly-30-day boundaries, different vaccines, new patients, concurrent creates, rollback on record-write failure, workspace isolation, and the UI continuation handler. It intentionally injects a write failure to verify rollback; the server logs that expected error. It does not exercise a real D1 deployment or render a browser.

The new alternate-path test fails on the original route (201 instead of 409) and passes with this fix. Existing duplicate-patient and patient-edit suites remain part of the test command.

## Deployment and review

This is a source-code change. Do not mark the live issue resolved merely because this branch is merged. Per README.md, GitHub Pages serves the compiled root index.html/assets, while the API runs on the existing Site Worker with D1.

1. Review and merge the source changes through the pull request.
2. Build and deploy the backend to the existing Site project, retaining its existing D1 database. No database migration is required.
3. Rebuild the GitHub interface using the command above; copy github-pages-dist contents to the repository root per README.md and commit/publish the compiled output. This PR does not replace generated root assets.
4. Retest the deployed UI with unique fictional data: save a baseline patient, start a new patient with matching first/last/DOB and changed email/address, verify both save paths reject it, then explicitly select the original patient and save a valid vaccination. Verify its original contact details remain unchanged.
5. Verify same-day/29-day vaccination repeats are blocked and exactly 30 days is accepted. Record fresh screenshots and expected/actual results for Card #989.

AI provenance: ChatGPT/Codex authored the patch and regression tests. The student/team should review the changes and confirm the deployed behavior before accepting the card. The earlier course-board security rollback is separate from this patient-data bug.
