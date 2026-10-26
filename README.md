# MediaVault

MediaVault is an authenticated media post management platform built with FastAPI. It lets users upload image or video files to ImageKit, save post metadata in SQLite, browse the post archive, and delete posts they own. A lightweight Vue 3 frontend is included for using the API in a browser.

This project is a media-management application. It does not implement social features such as comments, likes, followers, or activity feeds.

## Features

- Account registration and JWT-based sign-in with FastAPI Users.
- Authenticated profile retrieval and self-service email/password updates.
- Password-reset and email-verification token flows.
- Authenticated media post listing and upload.
- Multipart uploads with a caption and file; ImageKit stores and delivers the uploaded media.
- Post metadata including media URL, file type, original filename, author email, creation time, and ownership indicator.
- Owner-only post deletion enforced by the backend.
- Browser-based Vue 3 dashboard with no frontend build step.

## Technology stack

| Area | Implementation |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn |
| Authentication | `fastapi-users` with bearer JWTs (one-hour lifetime) |
| Database | SQLite (`test.db`) with SQLAlchemy async and `aiosqlite` |
| Media storage/delivery | ImageKit via `imagekitio` |
| Frontend | Vue 3 browser CDN build, plain HTML/CSS/JavaScript, Fetch API |
| Dependency management | `uv` / `pyproject.toml` |

## Architecture

```text
.
├── app/
│   ├── app.py          # FastAPI app, CORS, auth routers, post endpoints
│   ├── db.py           # Async SQLite engine and User/Post models
│   ├── images.py       # ImageKit client configuration
│   ├── schemas.py      # API response and FastAPI Users schemas
│   └── users.py        # JWT strategy and FastAPI Users manager
├── frontend/
│   ├── index.html      # Vue single-page application shell
│   ├── css/style.css   # Responsive UI styles
│   └── js/
│       ├── api.js      # Centralized API client
│       ├── auth.js     # Browser token storage helpers
│       └── app.js      # Vue views and UI behavior
├── main.py             # Uvicorn entry point
├── pyproject.toml      # Project metadata and dependencies
└── test.db             # Local SQLite database (created/updated at startup)
```

## Prerequisites

- Python 3.14 or newer (as declared in `pyproject.toml`)
- [uv](https://docs.astral.sh/uv/) for dependency management
- An ImageKit account and private API key
- A modern browser for the optional frontend

## Installation and local setup

1. Clone the repository and enter it.

   ```bash
   git clone <your-repository-url>
   cd mediavault
   ```

2. Install the Python dependencies.

   ```bash
   uv sync
   ```

3. Create a `.env` file in the project root. Use a long random `SECRET`; do not commit this file.

   ```env
   SECRET=replace-with-a-long-random-secret
   IMAGEKIT_PRIVATE_KEY=replace-with-your-imagekit-private-key
   IMAGEKIT_PUBLIC_KEY=your-imagekit-public-key
   IMAGEKIT_URL=https://ik.imagekit.io/your-imagekit-id
   ```

4. Start the API.

   ```bash
   uv run python main.py
   ```

   The API runs at `http://127.0.0.1:8000`. FastAPI creates the SQLite tables and applies the small `posts`-table compatibility migrations at startup.

5. Open the interactive API documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SECRET` | Yes | Signs JWTs and password-reset/email-verification tokens. The app refuses to start when it is missing. |
| `IMAGEKIT_PRIVATE_KEY` | Yes for uploads | Authenticates server-side uploads to ImageKit. |
| `IMAGEKIT_PUBLIC_KEY` | Present in the current `.env` convention | Not consumed by the current server code. It may be useful for future client-side ImageKit configuration. |
| `IMAGEKIT_URL` | Present in the current `.env` convention | Not consumed by the current server code. |

Keep all values secret where appropriate—especially `SECRET` and `IMAGEKIT_PRIVATE_KEY`.

## Authentication

The API uses bearer JWTs through FastAPI Users.

1. Create an account with `POST /auth/register`.
2. Log in through `POST /auth/jwt/login` using **form-encoded** `username` (the email address) and `password`.
3. The server returns `access_token` and `token_type` (`bearer`).
4. Send the access token with protected requests:

   ```http
   Authorization: Bearer <access_token>
   ```

Tokens expire after 3,600 seconds. The JWT backend is stateless: calling the logout endpoint does not revoke an already-issued token server-side. The bundled frontend removes its locally stored token on logout.

Registration does not automatically authenticate the new user. The currently configured user model does not require a verified email for protected routes, though verification endpoints are available.

> **Development note:** Password-reset and verification tokens are printed to the API server console by the current callbacks. No email delivery provider is configured.

## API reference

Interactive endpoint details and schemas are available at `/docs` while the API is running.

| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Create a user account. | No |
| `POST` | `/auth/jwt/login` | Exchange form credentials for a bearer JWT. | No |
| `POST` | `/auth/jwt/logout` | Logout endpoint supplied by FastAPI Users. | Yes |
| `POST` | `/auth/forgot-password` | Request a password-reset token. | No |
| `POST` | `/auth/reset-password` | Reset a password using a token. | No |
| `POST` | `/auth/request-verify-token` | Request an email-verification token. | No |
| `POST` | `/auth/verify` | Verify an email using a token. | No |
| `GET` | `/users/me` | Read the authenticated user profile. | Yes |
| `PATCH` | `/users/me` | Update the authenticated user profile. | Yes |
| `GET` | `/users/{id}` | Read a user by ID. | Yes, superuser required |
| `PATCH` | `/users/{id}` | Update a user by ID. | Yes, superuser required |
| `DELETE` | `/users/{id}` | Delete a user by ID. | Yes, superuser required |
| `GET` | `/posts/` | List media posts, newest first. | Yes |
| `POST` | `/posts/` | Upload a media post. | Yes |
| `DELETE` | `/posts/{post_id}` | Delete a post owned by the authenticated user. | Yes |

The API returns `401 Unauthorized` for missing/invalid credentials on protected endpoints. Deleting another user's post returns `403 Forbidden`; a missing post returns `404 Not Found`.

## Usage examples

### Register

```bash
curl -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"a-safe-password"}'
```

### Log in

`/auth/jwt/login` expects form data, not JSON.

```bash
curl -X POST http://127.0.0.1:8000/auth/jwt/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=a-safe-password"
```

Example response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

### Upload a media post

```bash
curl -X POST http://127.0.0.1:8000/posts/ \
  -H "Authorization: Bearer <access_token>" \
  -F "caption=Product walkthrough" \
  -F "file=@./walkthrough.mp4"
```

The request must use `multipart/form-data`. A successful upload returns `201 Created` and a record in this shape:

```json
{
  "id": "0e86a4a2-1f8e-4c5d-b324-0ad914fc7ce5",
  "user_id": "d6f13f1f-c10f-4cfb-8d96-24bf2fddf23b",
  "caption": "Product walkthrough",
  "url": "https://ik.imagekit.io/...",
  "file_type": "non-image",
  "file_name": "walkthrough.mp4",
  "created_at": "2026-10-26T12:00:00.000000",
  "is_owner": true,
  "email": "user@example.com"
}
```

### List or delete posts

```bash
curl http://127.0.0.1:8000/posts/ \
  -H "Authorization: Bearer <access_token>"

curl -X DELETE http://127.0.0.1:8000/posts/<post_id> \
  -H "Authorization: Bearer <access_token>"
```

## Media workflow and ImageKit

1. An authenticated user submits a `caption` and a file to `POST /posts/`.
2. The API temporarily writes the incoming upload to disk.
3. The server uploads that file to ImageKit with a unique filename and the tags `backend` and `fastapi`.
4. The API records the ImageKit URL, detected `file_type`, original filename, caption, owner ID, and creation time in SQLite.
5. The temporary file is removed after the request completes.
6. Authenticated users can retrieve the metadata and ImageKit delivery URL through `GET /posts/`.

The application protects its API endpoints, but the implementation does not configure ImageKit private delivery, media encryption, file scanning, or deletion of the remote ImageKit asset when a database post is deleted. Treat the returned ImageKit URL according to your ImageKit delivery settings.

## Frontend

The `frontend/` directory contains a standalone Vue 3 application served directly by a browser. It supports the implemented authentication flows, profile updates, listing posts, uploading files, and deleting owned posts.

With the backend running, serve it from the repository root:

```bash
python -m http.server 5500 --directory frontend
```

Open [http://127.0.0.1:5500](http://127.0.0.1:5500). The frontend API base URL defaults to `http://127.0.0.1:8000` in `frontend/js/api.js`.

The backend CORS policy permits the development origins `http://127.0.0.1:5500` and `http://localhost:5500`. Add an explicit origin in `app/app.py` before serving the frontend from a different host or port.

For this local demo, the frontend stores the bearer access token in `localStorage`. This is convenient for page refreshes but has XSS exposure; an httpOnly secure-cookie design is generally preferable for production.

## Screenshots

No screenshots are currently included in this repository.

## Limitations and possible improvements

Implemented behavior is limited to the endpoints and workflows above. Potential future work includes:

- Configure an email provider instead of printing password-reset and verification tokens to the server console.
- Use database migrations and configurable environment-based database URLs instead of the current fixed local SQLite path.
- Delete or otherwise manage the matching ImageKit asset when a post is deleted.
- Add file size/type validation, malware scanning, and richer upload error handling.
- Add token revocation/rotation or migrate to secure httpOnly cookie authentication.
- Add pagination, filtering, and search for large media archives.
- Add automated tests and a production deployment configuration.

## License

No license has been specified in this repository.

## Author

Bilal Aqeel
