# ParrotCare AI

ParrotCare AI is a full-stack parrot care and wellness assistant. It combines owner-managed care records, curated knowledge retrieval, deterministic emergency guidance, descriptive analytics, and an optional LLM integration. It is not a veterinary diagnostic service.

## Repository

- `backend/`: Django REST API, domain services, and ML inference/training boundaries.
- `frontend/`: React and Vite user interface.
- `docs/`: architecture, implementation checklist, data science limitations, and deployment notes.
- `render.yaml`: Render Blueprint for the API, static frontend, and PostgreSQL.

## Local development

Prerequisites: Python 3.12+, Node.js 20+, and PostgreSQL (or SQLite for local development).

1. Copy `.env.example` to `.env` and set `DJANGO_SECRET_KEY` for any non-disposable deployment.
2. In `backend/`, create a virtual environment, install `requirements.txt`, then run `python manage.py migrate`, `python manage.py seed_reference_data`, and `python manage.py runserver`.
3. In `frontend/`, run `npm install` and `npm run dev`.

The API is available at `http://localhost:8000/api/v1/`; health is at `/api/health/`. The frontend uses `VITE_API_BASE_URL` at build time and defaults to the local API. Authentication uses Django sessions in HttpOnly cookies with CSRF protection; no JWTs or browser-stored bearer tokens are used. The API provides registration/login, owned parrot profiles and care observations, conservative symptom screening, knowledge search, daily routine suggestions, and analytics. No external AI key is needed for the retrieval-based assistant.

## Validation

From `backend/`, run `python manage.py check` and `python manage.py test`. From `frontend/`, run `npm run build` and `npm run lint`.

## Safety and data limitations

Emergency symptom rules take precedence over machine-learning output and are deliberately conservative. They should be reviewed by an avian veterinarian before production use. Clinical risk classification is unavailable: there is no verified, adequately labeled parrot clinical dataset included. The ML subsystem supports personal-history anomaly screening only when enough user-entered measurements exist; it does not diagnose. Synthetic/demo data must be labeled and must never be presented as clinical evidence. See `docs/data-science.md`.

## Deployment

See `docs/deployment.md` for Render setup, environment variables, seed commands, and production verification. Do not place server secrets in `VITE_*` variables.