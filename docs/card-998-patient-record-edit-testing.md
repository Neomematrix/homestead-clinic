# Card #998 — Test Editing Existing Patient Records

**Owner:** Elijah Sterling  
**User story:** As a clinic staff member, I can edit an existing patient's information and verify that the changes are saved correctly.

## Scope

Test the existing patient-edit workflow in the Homestead Clinic classroom demo. The application already provides the Edit patient action, the patient editor form, and the `POST /api/patient-intake` update mode.

## Test data (fictional only)

Use this synthetic patient when creating a disposable test profile in the demo:

| Field | Original value |
|---|---|
| First name | Alex |
| Last name | Example |
| Date of birth | 2000-01-01 |
| Gender | Male |
| Home address | 1 Demo Street, Homestead, FL 33030 |
| Phone | 305-555-0101 |
| Email | alex@example.com |
| Insurance | Demo coverage |
| Medical needs | Routine visit |

Edit these fields to verify persistence:

| Field | Updated value |
|---|---|
| First name | Alexandra |
| Date of birth | 2000-02-02 |
| Phone | 305-555-0199 |
| Email | new@example.com |
| Insurance | Updated coverage |
| Medical needs | Updated visit |

## Test procedure

1. Open the Homestead Clinic demo and navigate to **Staff records**.
2. Create a fictional patient using the original values above, if one does not already exist.
3. Add a fictional vaccination record to that patient (optional, for checking linked history).
4. In the patient list, select **Edit patient** for Alex Example.
5. Update the fields using the updated values above and click **Save changes**.
6. Confirm the UI reports **Patient information updated.**
7. Navigate away from the patient and return to **Patient details**. Search by the same patient ID.
8. Confirm the updated values display and remain saved after refreshing the page.
9. Confirm the patient ID remains unchanged and any linked vaccination history remains attached, with vaccine-specific fields (vaccine, date, dose, lot number) unchanged.
10. Verify invalid or conflicting updates are rejected appropriately (missing patient ID returns 404; duplicate patient identity returns 409; invalid fields return 400).

## Expected result

- Edited demographic/contact/insurance/medical-needs fields persist in the patient profile.
- The patient ID stays stable for the edited patient.
- Existing vaccination history stays associated with that patient and its vaccination details are not overwritten.
- Invalid edits and duplicate identities are blocked with an appropriate error.

## Demo access / credentials

This GitHub Pages classroom demo does **not** use a username/password login. The browser generates and stores a random workspace key in localStorage to keep the demo workspace scoped to that browser profile. Keep using the same browser profile for the same demo records. Do not add API keys, passwords, tokens, or real patient information to this repository. Use fictional data only.

## Automated test

The repository includes `scripts/test-patient-edit.cjs`, which exercises the patient-intake update handler against an isolated in-memory database. Run it from the project root:

```bash
node scripts/test-patient-edit.cjs
```

The existing `package.json` test script also invokes this test as part of `test:card-989`. Coordinate with the team before changing shared scripts or deploying backend changes.
