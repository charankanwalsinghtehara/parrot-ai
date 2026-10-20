from datetime import timedelta

import numpy as np
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (CareEntry, Conversation, KnowledgeArticle, Parrot,
                     RoutineCompletion, RoutineTask, Species, WeightMeasurement)
from .serializers import (ArticleSerializer, CareEntrySerializer, CompletionSerializer,
                          MessageSerializer, ObservationSerializer, ParrotSerializer,
                          RegisterSerializer, RoutineTaskSerializer, SpeciesSerializer,
                          UserSerializer, WeightSerializer)
from .services import evaluate_safety_flags, generate_assistant_reply, persist_chat

User = get_user_model()


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


@ensure_csrf_cookie
def csrf_cookie(request):
    return JsonResponse({"detail": "CSRF cookie set"})


@method_decorator(csrf_protect, name="dispatch")
class SessionLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = request.data.get("password", "")
        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response({"detail": "Email or password did not match."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response(UserSerializer(user).data)


@method_decorator(csrf_protect, name="dispatch")
class SessionLogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ParrotViewSet(viewsets.ModelViewSet):
    serializer_class = ParrotSerializer

    def get_queryset(self):
        return Parrot.objects.filter(owner=self.request.user).select_related("species")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="weight")
    def weight(self, request, pk=None):
        parrot = self.get_object()
        if request.method == "GET":
            return Response(WeightSerializer(parrot.weights.all(), many=True).data)
        serializer = WeightSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(parrot=parrot)
        parrot.weight_grams = item.grams
        parrot.save(update_fields=["weight_grams", "updated_at"])
        return Response(WeightSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="care")
    def care(self, request, pk=None):
        parrot = self.get_object()
        if request.method == "GET":
            return Response(CareEntrySerializer(parrot.care_entries.all()[:100], many=True).data)
        serializer = CareEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(parrot=parrot)
        return Response(CareEntrySerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="observations")
    def observations(self, request, pk=None):
        parrot = self.get_object()
        if request.method == "GET":
            return Response(ObservationSerializer(parrot.observations.all()[:100], many=True).data)
        serializer = ObservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(parrot=parrot)
        return Response(ObservationSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request, pk=None):
        parrot = self.get_object()
        weights = parrot.weights.order_by("measured_at")[:180]
        entries = parrot.care_entries.filter(occurred_at__gte=timezone.now() - timedelta(days=30))
        observations = parrot.observations.filter(observed_at__gte=timezone.now() - timedelta(days=30))
        counts = {row["kind"]: row["total"] for row in entries.values("kind").annotate(total=Count("id"))}
        return Response({
            "weight": WeightSerializer(weights, many=True).data,
            "care_counts_30d": counts,
            "observation_count_30d": observations.count(),
            "anomaly": weight_anomaly([item.grams for item in weights]),
            "clinical_risk_model": {"status": "unavailable", "reason": "No suitable validated labeled dataset is configured."},
        })

    @action(detail=True, methods=["get", "post"], url_path="routine")
    def routine(self, request, pk=None):
        parrot = self.get_object()
        if request.method == "GET":
            tasks = parrot.routine_tasks.filter(active=True)
            if not tasks.exists():
                templates = [("Refresh water", "hydration", True), ("Offer usual balanced diet", "feeding", True),
                             ("Provide supervised activity", "activity", False), ("Offer foraging or enrichment", "enrichment", False)]
                tasks = [RoutineTask.objects.create(parrot=parrot, title=title, category=category, essential=essential) for title, category, essential in templates]
            return Response(RoutineTaskSerializer(tasks, many=True).data)
        serializer = RoutineTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = serializer.save(parrot=parrot)
        return Response(RoutineTaskSerializer(task).data, status=status.HTTP_201_CREATED)


def weight_anomaly(values):
    if len(values) < 5:
        return {"status": "insufficient_history", "message": "Record at least five measurements to review personal trend variation."}
    recent = np.asarray(values[-3:], dtype=float)
    baseline = np.asarray(values[:-3], dtype=float)
    median = float(np.median(baseline))
    mad = float(np.median(np.abs(baseline - median)))
    scale = mad * 1.4826
    if scale == 0:
        changed = bool(np.any(recent != median))
        score = None
    else:
        score = float(np.max(np.abs(recent - median)) / scale)
        changed = score >= 3.5
    return {"status": "review_change" if changed else "no_statistical_flag", "score": score,
            "message": "A change from this bird's earlier measurements is worth discussing with an avian veterinarian." if changed else "No strong statistical change was detected; this does not establish that the bird is healthy."}


class SpeciesListView(generics.ListAPIView):
    queryset = Species.objects.all()
    serializer_class = SpeciesSerializer
    permission_classes = [permissions.AllowAny]


class KnowledgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ArticleSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = KnowledgeArticle.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(body__icontains=search) | Q(tags__icontains=search))
        return queryset


class ConversationListView(generics.ListAPIView):
    serializer_class = MessageSerializer

    def get_queryset(self):
        return Conversation.objects.filter(owner=self.request.user).order_by("-updated_at")

    def list(self, request, *args, **kwargs):
        conversations = self.get_queryset()
        return Response([{"id": item.id, "title": item.title, "parrot": item.parrot_id, "updated_at": item.updated_at,
                          "messages": MessageSerializer(item.messages.all(), many=True).data} for item in conversations])


class ChatView(APIView):
    def post(self, request):
        question = request.data.get("message", "")
        if not isinstance(question, str) or not question.strip() or len(question) > 4000:
            return Response({"message": "Provide a message of 1 to 4000 characters."}, status=400)
        parrot = None
        parrot_id = request.data.get("parrot")
        if parrot_id:
            parrot = get_object_or_404(Parrot, id=parrot_id, owner=request.user)
        conversation_id = request.data.get("conversation")
        conversation = get_object_or_404(Conversation, id=conversation_id, owner=request.user) if conversation_id else Conversation.objects.create(owner=request.user, parrot=parrot, title=question[:160])
        response = generate_assistant_reply(question.strip(), parrot)
        persist_chat(conversation, question.strip(), response)
        return Response({"conversation": conversation.id, "answer": response["text"], "urgent": response["urgent"],
                         "mode": response["mode"], "sources": [{"id": item.id, "title": item.title, "url": item.source_url} for item in response["sources"]]})


class RiskScreeningView(APIView):
    def post(self, request):
        parrot = get_object_or_404(Parrot, id=request.data.get("parrot"), owner=request.user)
        symptoms = request.data.get("symptoms", [])
        if not isinstance(symptoms, list) or any(not isinstance(item, str) for item in symptoms):
            return Response({"symptoms": "Expected a list of symptom descriptions."}, status=400)
        flags = evaluate_safety_flags(" ".join(symptoms))
        return Response({"parrot": parrot.id, "clinical_model": "unavailable", "urgent": flags["urgent"],
                         "matched_signs": flags["matched_signs"],
                         "guidance": "Contact an avian veterinarian or emergency service immediately." if flags["urgent"] else "This screening cannot diagnose or rule out illness. Contact an avian veterinarian for concerning or persistent signs."})


class CompleteTaskView(APIView):
    def post(self, request, task_id):
        task = get_object_or_404(RoutineTask, id=task_id, parrot__owner=request.user)
        completion, created = RoutineCompletion.objects.get_or_create(task=task, completed_on=timezone.localdate())
        return Response(CompletionSerializer(completion).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MLModelsView(APIView):
    def get(self, request):
        return Response({"clinical_risk": {"status": "unavailable", "reason": "No suitable labeled and validated dataset is configured."},
                         "personal_trend_anomaly": {"status": "available_with_sufficient_history", "method": "robust median/MAD", "diagnostic": False}})