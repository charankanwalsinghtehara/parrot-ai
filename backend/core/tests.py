from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Parrot, Species, WeightMeasurement
from core.services import evaluate_safety_flags, generate_assistant_reply
from core.views import weight_anomaly

User = get_user_model()


class SafetyServiceTests(TestCase):
    def test_emergency_flags_are_deterministic(self):
        result = evaluate_safety_flags("My bird has difficulty breathing at rest")
        self.assertTrue(result["urgent"])
        self.assertIn("difficulty breathing", result["matched_signs"])

    def test_emergency_precedes_retrieval_response(self):
        response = generate_assistant_reply("My parrot collapsed")
        self.assertTrue(response["urgent"])
        self.assertEqual(response["mode"], "safety-rule")
        self.assertIn("immediately", response["text"])


class OwnerIsolationTests(TestCase):
    def setUp(self):
        self.first = User.objects.create_user(username="first@example.test", email="first@example.test", password="Strong-pass-2048")
        self.second = User.objects.create_user(username="second@example.test", email="second@example.test", password="Strong-pass-2048")
        self.species = Species.objects.create(name="Cockatiel", common_name="Cockatiel")
        self.parrot = Parrot.objects.create(owner=self.first, name="Pip", species=self.species)
        self.client = APIClient()

    def test_user_cannot_retrieve_another_users_parrot(self):
        self.client.force_authenticate(self.second)
        response = self.client.get(f"/api/v1/parrots/{self.parrot.id}/")
        self.assertEqual(response.status_code, 404)

    def test_user_cannot_screen_another_users_parrot(self):
        self.client.force_authenticate(self.second)
        response = self.client.post("/api/v1/ml/risk-screening/", {"parrot": self.parrot.id, "symptoms": ["collapse"]}, format="json")
        self.assertEqual(response.status_code, 404)


class SessionAuthenticationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="session@example.test", email="session@example.test", password="Strong-pass-2048")
        self.client = APIClient(enforce_csrf_checks=True)

    def test_login_requires_csrf_token(self):
        response = self.client.post("/api/v1/auth/login/", {"email": self.user.email, "password": "Strong-pass-2048"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_login_creates_session_and_logout_clears_it(self):
        self.client.get("/api/v1/auth/csrf/")
        csrf_token = self.client.cookies["csrftoken"].value
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "Strong-pass-2048"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("sessionid", self.client.cookies)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 200)

        rotated_csrf = self.client.cookies["csrftoken"].value
        logout_response = self.client.post("/api/v1/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=rotated_csrf)
        self.assertEqual(logout_response.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 403)


class AnalyticsTests(TestCase):
    def test_insufficient_weight_history_is_not_scored(self):
        result = weight_anomaly([100, 101, 99])
        self.assertEqual(result["status"], "insufficient_history")

    def test_personal_trend_flags_a_large_change_without_diagnosis(self):
        result = weight_anomaly([100, 101, 100, 99, 100, 145])
        self.assertEqual(result["status"], "review_change")
        self.assertIn("not establish", weight_anomaly([100, 101, 99, 100, 100])["message"])


class APIValidationTests(TestCase):
    def test_invalid_observation_symptoms_rejected(self):
        user = User.objects.create_user(username="owner@example.test", email="owner@example.test", password="Strong-pass-2048")
        parrot = Parrot.objects.create(owner=user, name="Pip")
        client = APIClient()
        client.force_authenticate(user)
        response = client.post(f"/api/v1/parrots/{parrot.id}/observations/", {"observed_at": timezone.now().isoformat(), "symptoms": "not-a-list"}, format="json")
        self.assertEqual(response.status_code, 400)