# Homestead Clinic

Live interface: https://neomematrix.github.io/homestead-clinic/

Fictional classroom demonstration. Do not enter real patient information.

GitHub Pages serves the compiled interface from `index.html` and `assets/`. The existing clinic Worker and D1 database save patients, vaccination records, accuracy datasets and measurement timestamps. `app/api/github/[...path]/route.ts` permits the exact GitHub origin and scopes demo data to a random browser workspace key. This is demo isolation, not patient authentication.

The GitHub version starts with a separate demo workspace. Original Site records are preserved. Keep using the same browser profile: its workspace key is stored in localStorage; clearing browser storage removes access to that workspace, but does not delete its server records. CSV/JSON export remains available. This is not a migration of original Site data.

## Rebuild the GitHub interface

Use Node.js 22.13 or later and the package manager in package.json. Install the locked dependencies, then run:

```sh
pnpm exec vite build --config github-pages/vite.config.ts
```

Copy the contents of `github-pages-dist/` to the repository root, preserve `.nojekyll`, and commit the new index.html, favicon and assets. In Settings → Pages use Deploy from a branch, main, / (root). Keep the source folders; GitHub Pages does not run API route source files.

Backend changes must also be built and deployed to the existing Site project, retaining its D1 database. Changes to frontend and backend must be coordinated. Source includes the existing duplicate patient prevention and dynamic record-accuracy measurement.
