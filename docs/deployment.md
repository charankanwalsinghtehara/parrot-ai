# Render Deployment (Separate Services)

Deploy the API and frontend as two independent Render services. Replace the example hostnames below with the actual `.onrender.com` hostnames Render assigns.

## Django API

- Create a **Web Service** with root directory `backend` and Python runtime.
- Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
- Start command: `python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- Health check path: `/api/health/`
- Set these environment variables on the API service:
  - `DJANGO_DEBUG=false`
  - `DJANGO_SECRET_KEY` to a long, randomly generated secret
  - `DATABASE_URL` to the connection string of a PostgreSQL database
  - `DJANGO_ALLOWED_HOSTS` to the API hostname only, without a scheme, for example `parrotcare-api.onrender.com`
  - `CORS_ALLOWED_ORIGINS` to the frontend origin, including scheme, for example `https://parrotcare-web.onrender.com`
  - `CSRF_TRUSTED_ORIGINS` to the same frontend origin, including scheme
  - `AI_PROVIDER=none` unless a supported AI provider is intentionally configured

The start command binds Gunicorn to Render's assigned `$PORT`; omitting this bind can leave the service unreachable and fail the health check. The Django API uses session-cookie authentication with CSRF protection, not JWT.

## React Frontend

- Create a **Static Site** with root directory `frontend`.
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Add a rewrite from `/*` to `/index.html` so client-side routes load directly.
- Set the build-time environment variable `VITE_API_BASE_URL` to the full API origin and API prefix, for example `https://parrotcare-api.onrender.com/api/v1`.

Vite variables are public and embedded in the built site. Never put Django secrets, database credentials, or AI provider keys in `VITE_*` variables. If either service's hostname changes, update the API allowlists and redeploy the frontend if its API URL changed.

## After Deployment

Confirm `/api/health/` returns `{"status":"ok"}`, then create an administrator from the API service shell with `python manage.py createsuperuser` and seed reference data with `python manage.py seed_reference_data`. Test registration/login, profile creation, care records, and frontend API connectivity. Clinical ML remains unavailable unless approved data and artifact governance have been completed.

Keep the filesystem treated as ephemeral; do not rely on local uploads or model artifacts surviving a deploy. Configure a persistent PostgreSQL database for application data.
