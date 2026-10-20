# Architecture

## Request path

React/Vite calls the versioned Django REST API. Django serializers validate input, authenticated views enforce ownership, and focused services handle retrieval, safety triage, routine recommendations, and analytics. Django ORM stores user-owned records in PostgreSQL. Optional LLM calls are isolated behind an AI provider service and can be disabled without affecting retrieval or safety checks.

## Boundaries

- `accounts`: user registration and Django session authentication with CSRF protection.
- `parrots`: species reference and owner-controlled bird profiles.
- `care`: feeding, weight, activity and routine data.
- `health`: observations and deterministic symptom triage.
- `knowledge`: curated articles and search.
- `assistant`: conversations and retrieval/provider orchestration.
- `analytics`: per-bird descriptive trends.
- `ml_engine`: isolated feature extraction, anomaly inference, training interfaces and metadata.

The initial implementation keeps domain modules within one Django app package to avoid premature service proliferation; modules remain separated by responsibility. Training is an offline command, never request-time work. Clinical predictions are explicitly unavailable until suitable provenance and validation exist.

## Safety invariants

1. Deterministic emergency rules run before optional AI or ML.
2. A low-risk result cannot establish health or override urgent symptoms.
3. Assistant citations are returned only for stored knowledge articles.
4. All bird-specific endpoints scope queries to the authenticated owner.
5. Statistical anomalies mean “review this change,” not diagnosis.