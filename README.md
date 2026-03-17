# A-Level Performance Dashboard

This repository contains a static HTML/CSS/JavaScript dashboard for tracking Cambridge AS Level preparation.

## Deployment

Deployment is automated using **GitHub Pages** via `.github/workflows/deploy.yml`.

### One-time setup (GitHub repository settings)

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Ensure your default production branch is `main` (or update the workflow trigger if using a different branch).

### Deploy flow

- Push changes to `main`.
- GitHub Actions runs the **Deploy static dashboard to GitHub Pages** workflow.
- The site is published automatically and the workflow output includes the live URL.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.
