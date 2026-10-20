from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import CareEntry, HealthObservation, KnowledgeArticle, Message, Parrot, RoutineCompletion, RoutineTask, Species, WeightMeasurement

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name"]

    def create(self, validated_data):
        email = validated_data.pop("email").lower()
        return User.objects.create_user(username=email, email=email, **validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]
        read_only_fields = fields


class SpeciesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Species
        fields = ["id", "name", "common_name", "care_notes", "source_url"]


class ParrotSerializer(serializers.ModelSerializer):
    species_name = serializers.CharField(source="species.common_name", read_only=True)

    class Meta:
        model = Parrot
        exclude = ["owner"]
        read_only_fields = ["created_at", "updated_at"]


class WeightSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightMeasurement
        fields = ["id", "grams", "measured_at", "note"]


class CareEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareEntry
        fields = ["id", "kind", "occurred_at", "detail", "amount", "created_at"]


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthObservation
        fields = ["id", "observed_at", "symptoms", "notes", "appetite_change", "activity_change", "created_at"]

    def validate_symptoms(self, value):
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            raise serializers.ValidationError("Symptoms must be a list of text labels.")
        return [item.strip()[:80] for item in value if item.strip()]


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeArticle
        fields = ["id", "title", "body", "source_title", "source_url", "reviewed", "tags", "updated_at"]


class RoutineTaskSerializer(serializers.ModelSerializer):
    completed_today = serializers.SerializerMethodField()

    class Meta:
        model = RoutineTask
        fields = ["id", "title", "category", "scheduled_time", "essential", "active", "completed_today"]
        read_only_fields = ["id", "completed_today"]

    def get_completed_today(self, obj):
        from django.utils import timezone
        return obj.completions.filter(completed_on=timezone.localdate()).exists()


class CompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutineCompletion
        fields = ["id", "completed_on", "note"]
        read_only_fields = ["id", "completed_on"]


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "metadata", "created_at"]