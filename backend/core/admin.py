from django.contrib import admin

from .models import (CareEntry, Conversation, HealthObservation, KnowledgeArticle,
                     Message, Parrot, RoutineCompletion, RoutineTask, Species,
                     WeightMeasurement)


@admin.register(Parrot)
class ParrotAdmin(admin.ModelAdmin):
    list_display = ("name", "species", "owner", "archived")
    list_filter = ("archived", "species")
    search_fields = ("name", "owner__email")


@admin.register(KnowledgeArticle)
class KnowledgeArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "source_title", "reviewed", "updated_at")
    list_filter = ("reviewed",)
    search_fields = ("title", "body", "source_title")


admin.site.register([Species, WeightMeasurement, CareEntry, HealthObservation,
                     Conversation, Message, RoutineTask, RoutineCompletion])