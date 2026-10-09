## Security & Deployment Guidelines

This app will eventually be accessible over the internet, although it is currently intended primarily for personal use. Build features with that future deployment in mind.

- Never commit passwords, API keys, tokens, or other secrets. Use environment variables and keep `.env` files out of Git.
- Never put secrets in `VITE_*` variables because those values are exposed to the browser.
- Treat all frontend/user input as untrusted. Validate important input again in the API.
- Use Sequelize safely; do not build raw SQL by concatenating user input.
- Authentication and authorization must be enforced by the backend, not just Vue route guards.
- Design user-owned data with a `userId`/ownership relationship even while the app has only one user.
- Do not expose PostgreSQL directly to the internet.
- Do not expose unnecessary API, Docker, debug, or development ports.
- Do not return stack traces, database details, secrets, or internal server information to clients in production.
- Use HTTPS when the app is eventually deployed publicly.
- Use secure HTTP headers and reasonable rate limiting for internet-facing endpoints, especially authentication.
- Keep development and production configuration separate.

### Photo Uploads

The app will eventually store fishing/catch photos on the home server.

When implementing photo uploads:

- Treat uploaded files as untrusted.
- Restrict uploads to supported image formats and reasonable file sizes.
- Verify file types instead of trusting filenames/extensions.
- Generate unique server-side filenames.
- Never allow user-provided filenames to control filesystem paths.
- Optimize/resize large phone photos when appropriate.
- Strip unnecessary EXIF metadata, especially embedded GPS coordinates.
- Store image files on persistent storage, not inside a disposable Docker container.
- Store image metadata/path information in PostgreSQL rather than storing the image itself in PostgreSQL.
- Design photo storage so it can later be moved to another disk or storage provider without redesigning the application.

### General Rule

When implementing a feature, prefer the approach that would remain safe if the application were publicly reachable. Do not add unnecessary complexity solely for hypothetical future requirements, but flag security-sensitive design decisions before implementing an unsafe shortcut.
