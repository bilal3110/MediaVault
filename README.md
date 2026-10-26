# FastAPI posts API

## Authentication

1. Set a long, random `SECRET` value in `.env`. The app will refuse to start if
   it is absent.
2. Create an account with `POST /auth/register` using an `email` and `password`.
3. Log in with form data at `POST /auth/jwt/login` (`username` is the account
   email). The response contains an `access_token`.
4. Send the token on each posts request:
   `Authorization: Bearer <access_token>`.

`POST /posts/`, `GET /posts/`, and `DELETE /posts/{post_id}` all require an
active account. A user can delete only a post whose `user_id` matches their own
account. JWT access tokens expire after one hour.

Interactive API documentation is available at `/docs` while the server is
running.
