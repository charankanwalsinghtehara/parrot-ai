# Render Deployment

1. Push this repository to a Git provider and create a Render Blueprint from the repository root.
2. Review the Blueprint and provision the managed PostgreSQL database, Django web service, and static site.
3. Enter `DJANGO_SECRET_KEY` as a secret in Render. Configure `AI_PROVIDER`, `AI_API_KEY`, and `AI_MODEL` only when a supported provider is desired. Never expose these through Vite variables.
4. Set the frontend build-time `VITE_API_BASE_URL` to the deployed API URL plus `/api/v1` and configure API `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` with the assigned frontend origin.
5. Wait for deploy-time migrations and health check `/api/health/`; create an administrator with `python manage.py createsuperuser` via the Render shell.
6. Run `python manage.py seed_reference_data`, confirm the stored articles have reviewed source metadata, and test registration, ownership isolation, assistant fallback, routine creation, and frontend connectivity.
7. Confirm optional AI behavior and verify clinical ML remains unavailable unless approved data/artifact governance has been completed.

Blueprint-managed values include `DATABASE_URL` and service wiring. Required/manual values include the Django secret and production domain allowlists. `DJANGO_DEBUG` must remain false in production. Keep the filesystem treated as ephemeral; do not rely on local uploads or model artifacts surviving a deploy.