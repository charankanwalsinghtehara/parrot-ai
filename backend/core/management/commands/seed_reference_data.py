from django.core.management.base import BaseCommand

from core.models import KnowledgeArticle, Species


SPECIES = [
    ("African grey", "African grey parrot"),
    ("Budgerigar", "Budgerigar"),
    ("Cockatiel", "Cockatiel"),
    ("Cockatoo", "Cockatoo"),
    ("Macaw", "Macaw"),
    ("Amazon parrot", "Amazon parrot"),
    ("Conure", "Conure"),
    ("Lovebird", "Lovebird"),
]

ARTICLES = [
    {
        "title": "Finding qualified avian veterinary care",
        "body": "Parrot health concerns should be assessed by a veterinarian with relevant avian experience. Seek prompt professional advice for sudden, persistent, or worsening changes. This article is a starting point, not an examination or diagnosis.",
        "source_title": "Association of Avian Veterinarians: Find a Vet",
        "source_url": "https://www.aav.org/page/FindAVet",
        "tags": ["veterinarian", "health", "safety"],
    },
    {
        "title": "Bird nutrition requires individualized guidance",
        "body": "Diet planning should account for the individual bird, species, health history, and veterinary advice. Avoid making abrupt diet changes or relying on a generic feeding quantity. Ask an avian veterinarian to review a bird's current diet and any planned changes.",
        "source_title": "VCA Animal Hospitals: Feeding Birds",
        "source_url": "https://vcahospitals.com/know-your-pet/feeding-birds",
        "tags": ["feeding", "nutrition", "diet"],
    },
    {
        "title": "Enrichment and daily welfare",
        "body": "Provide appropriate opportunities for activity, interaction, and enrichment, tailored to the bird's abilities and environment. Introduce changes safely and supervise unfamiliar activities. A veterinarian or qualified behavior professional can advise when behavior changes are concerning.",
        "source_title": "RSPCA: Pet birds",
        "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/birds",
        "tags": ["enrichment", "activity", "behavior"],
    },
]


class Command(BaseCommand):
    help = "Create common species and sourced starter articles idempotently. Articles remain unreviewed."

    def handle(self, *args, **options):
        for name, common_name in SPECIES:
            Species.objects.get_or_create(name=name, defaults={"common_name": common_name})
        for item in ARTICLES:
            KnowledgeArticle.objects.get_or_create(title=item["title"], defaults={**item, "reviewed": False})
        self.stdout.write(self.style.SUCCESS("Reference species and unreviewed sourced articles are ready."))