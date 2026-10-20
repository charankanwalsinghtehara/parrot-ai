from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (ChatView, CompleteTaskView, ConversationListView, KnowledgeViewSet,
					MLModelsView, MeView, ParrotViewSet, RegisterView, SessionLoginView,
					SessionLogoutView, csrf_cookie,
					RiskScreeningView, SpeciesListView)

router = DefaultRouter()
router.register("parrots", ParrotViewSet, basename="parrot")
router.register("knowledge", KnowledgeViewSet, basename="knowledge")

urlpatterns = [
	path("auth/csrf/", csrf_cookie, name="csrf-cookie"),
	path("auth/register/", RegisterView.as_view(), name="register"),
	path("auth/login/", SessionLoginView.as_view(), name="session-login"),
	path("auth/logout/", SessionLogoutView.as_view(), name="session-logout"),
	path("auth/me/", MeView.as_view(), name="me"),
	path("species/", SpeciesListView.as_view(), name="species"),
	path("assistant/chat/", ChatView.as_view(), name="chat"),
	path("assistant/conversations/", ConversationListView.as_view(), name="conversations"),
	path("ml/risk-screening/", RiskScreeningView.as_view(), name="risk-screening"),
	path("ml/models/", MLModelsView.as_view(), name="ml-models"),
	path("routine-tasks/<int:task_id>/complete/", CompleteTaskView.as_view(), name="complete-task"),
	path("", include(router.urls)),
]