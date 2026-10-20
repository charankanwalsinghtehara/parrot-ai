from django.conf import settings
from django.db import models


class Species(models.Model):
    name = models.CharField(max_length=100, unique=True)
    common_name = models.CharField(max_length=100)
    care_notes = models.TextField(blank=True)
    source_url = models.URLField(blank=True)

    def __str__(self):
        return self.common_name


class Parrot(models.Model):
    SEX_CHOICES = [("unknown", "Unknown"), ("female", "Female"), ("male", "Male")]
    ACTIVITY_CHOICES = [("low", "Low"), ("moderate", "Moderate"), ("high", "High")]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parrots")
    name = models.CharField(max_length=80)
    species = models.ForeignKey(Species, null=True, blank=True, on_delete=models.SET_NULL)
    subspecies = models.CharField(max_length=100, blank=True)
    hatch_date = models.DateField(null=True, blank=True)
    estimated_age = models.CharField(max_length=80, blank=True)
    sex = models.CharField(max_length=10, choices=SEX_CHOICES, default="unknown")
    weight_grams = models.PositiveIntegerField(null=True, blank=True)
    diet = models.TextField(blank=True)
    activity_level = models.CharField(max_length=12, choices=ACTIVITY_CHOICES, blank=True)
    medical_conditions = models.TextField(blank=True)
    medications = models.TextField(blank=True)
    sensitivities = models.TextField(blank=True)
    housing = models.TextField(blank=True)
    acquired_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    veterinarian_name = models.CharField(max_length=120, blank=True)
    veterinarian_contact = models.CharField(max_length=160, blank=True)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["owner", "archived"])]

    def __str__(self):
        return self.name


class WeightMeasurement(models.Model):
    parrot = models.ForeignKey(Parrot, on_delete=models.CASCADE, related_name="weights")
    grams = models.PositiveIntegerField()
    measured_at = models.DateTimeField()
    note = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["measured_at"]
        indexes = [models.Index(fields=["parrot", "measured_at"])]


class CareEntry(models.Model):
    KIND_CHOICES = [(key, key.title()) for key in ("feeding", "hydration", "activity", "sleep", "enrichment")]
    parrot = models.ForeignKey(Parrot, on_delete=models.CASCADE, related_name="care_entries")
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    occurred_at = models.DateTimeField()
    detail = models.CharField(max_length=240, blank=True)
    amount = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [models.Index(fields=["parrot", "kind", "occurred_at"])]


class HealthObservation(models.Model):
    parrot = models.ForeignKey(Parrot, on_delete=models.CASCADE, related_name="observations")
    observed_at = models.DateTimeField()
    symptoms = models.JSONField(default=list)
    notes = models.TextField(blank=True)
    appetite_change = models.BooleanField(default=False)
    activity_change = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-observed_at"]
        indexes = [models.Index(fields=["parrot", "observed_at"])]


class KnowledgeArticle(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField()
    source_title = models.CharField(max_length=200)
    source_url = models.URLField()
    reviewed = models.BooleanField(default=False)
    tags = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]


class Conversation(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    parrot = models.ForeignKey(Parrot, null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Message(models.Model):
    ROLE_CHOICES = [("user", "User"), ("assistant", "Assistant")]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class RoutineTask(models.Model):
    parrot = models.ForeignKey(Parrot, on_delete=models.CASCADE, related_name="routine_tasks")
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=32)
    scheduled_time = models.TimeField(null=True, blank=True)
    essential = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RoutineCompletion(models.Model):
    task = models.ForeignKey(RoutineTask, on_delete=models.CASCADE, related_name="completions")
    completed_on = models.DateField()
    note = models.CharField(max_length=240, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "completed_on"], name="unique_task_completion_day")]