# Post Registry frontend

This is a build-free Vue 3 single-page frontend. It uses the browser CDN build of Vue, plain CSS, and the Fetch API—no Node.js, npm, Vite, or bundler is required.

## Run it locally

1. Start the FastAPI API from the project root:

   ```powershell
   uv run python main.py
   ```

2. Serve this directory over HTTP (do not open `index.html` using `file://`):

   ```powershell
   python -m http.server 5500 --directory frontend
   ```

3. Open `http://127.0.0.1:5500`.

The API base URL is centralized at the top of `js/api.js` and defaults to `http://127.0.0.1:8000`. To use another API, assign a URL before loading `api.js`, for example in `index.html`:

```html
<script>window.APP_CONFIG = { apiBaseUrl: 'https://api.example.com' };</script>
```

## API contract used

- Login: `POST /auth/jwt/login` with URL-encoded `username` (email) and `password`; response has `access_token` and `token_type`.
- Registration, password reset, and email verification: JSON requests.
- Posts: authenticated `GET /posts/`, multipart `POST /posts/` with `caption` and `file`, and `DELETE /posts/{post_id}`.
- Profile: authenticated `GET`/`PATCH /users/me`; this UI allows only email and password updates.

The backend is configured for bearer JWTs. The frontend stores only the access token in `localStorage` so a refreshed demo page remains signed in. This is convenient for a local demo but increases exposure to XSS; an httpOnly, secure cookie design is generally preferable for production.

## CORS

The backend includes a deliberately narrow development CORS policy for `http://127.0.0.1:5500` and `http://localhost:5500`. If the static server uses another origin, add that exact origin to the `allow_origins` list in `app/app.py`; do not use `*` for an authenticated production API.

## Notes and testing

The FastAPI Users endpoints create/reset/verify tokens, but the current backend prints those tokens to its server console; it does not configure email delivery. Copy a development token from that output into the reset/verify form, or use `?view=reset&token=...` / `?view=verify&token=...`.

JWT logout is stateless in this backend: the UI calls `/auth/jwt/logout` and removes the local token, but the server does not revoke an already-issued JWT. User-by-ID helpers are present in `js/api.js` for future superuser functionality; no admin interface is exposed because the backend requires superuser permissions.
