# Forge â€” AI Engineer Learning Portal

A static, project-first learning portal prototype. The interface is built with HTML, CSS, and vanilla JavaScript; curriculum data lives in `content.json` so lessons can be revised without changing the UI code.

Levels 1â€“3 contain twelve lessons: editor and Python setup, Python foundations, and a hands-on learning progress tracker project. Level 6 contains eight Google Cloud deployment lessons adapted from the connected Notion deployment notes. It starts with account/project and billing setup, then the Google Cloud CLI, basic configuration, Artifact Registry, secrets/IAM, Cloud Run, GitHub Actions, and verification. Lessons include concepts, practical steps, code, expected output, and hints. Admin can open any populated level; learner accounts unlock populated levels in order.

## Demo sign-in

- Admin: `admin` / `12345`
- Learner: `user` / `12345`

This is only a front-end demonstration. The credentials are visible in the page source and do not protect course data. Use a backend with hashed passwords and proper sessions before using real accounts or publishing authentication.

## Preview locally

Because the page fetches `content.json`, serve the folder over HTTP instead of opening `index.html` directly. For example, from this directory run `python -m http.server 8000`, then visit `http://localhost:8000`.

## Publish with GitHub Pages

1. Create a GitHub repository and add these files.
2. In the repository, open **Settings â†’ Pages**.
3. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Share the generated `https://<username>.github.io/<repository>/` link.

The sample is static and stores lesson completion in the learner's browser. Add a backend only if you need accounts, synced progress, private course content, or instructor reporting.

## Content model

`content.json` has a path title, overall lesson count, and a list of modules. Each module has descriptive metadata and may include a lesson object with a concept, hands-on steps, runnable code, expected output, and hint. This keeps the curriculum editable independently from presentation.

