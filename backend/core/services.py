import re

from django.conf import settings
from django.db.models import Q

from .models import KnowledgeArticle, Message

EMERGENCY_TERMS = {
    "difficulty breathing", "open-mouth breathing", "open mouth breathing", "seizure",
    "collapse", "severe bleeding", "bleeding heavily", "toxic exposure", "fume exposure",
    "cannot perch", "unable to perch", "severe weakness", "trauma",
}


def evaluate_safety_flags(text):
    normalized = re.sub(r"\s+", " ", text.lower())
    matched = sorted(term for term in EMERGENCY_TERMS if term in normalized)
    return {"urgent": bool(matched), "matched_signs": matched}


def retrieve_relevant_knowledge(question, limit=4):
    terms = [word for word in re.findall(r"[a-zA-Z]{3,}", question.lower()) if word not in {"the", "and", "for", "what", "why", "how", "with", "has", "have"}]
    query = Q()
    for term in terms[:12]:
        query |= Q(title__icontains=term) | Q(body__icontains=term) | Q(tags__icontains=term)
    return list(KnowledgeArticle.objects.filter(query).distinct()[:limit]) if terms else []


def generate_assistant_reply(question, parrot=None):
    safety = evaluate_safety_flags(question)
    articles = retrieve_relevant_knowledge(question)
    if safety["urgent"]:
        text = ("This may be an emergency. Contact an avian veterinarian or emergency veterinary service immediately; "
                "do not wait for more information here. Do not give human medication or attempt home treatment. "
                "A symptom description cannot confirm a diagnosis.")
        return {"text": text, "urgent": True, "mode": "safety-rule", "sources": articles}

    provider = getattr(settings, "AI_PROVIDER", "none").lower()
    api_key = getattr(settings, "AI_API_KEY", "")
    if provider == "openai" and api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key, base_url=getattr(settings, "AI_BASE_URL", "") or None, timeout=12.0, max_retries=1)
            context = "\n".join(f"{article.title}: {article.body}" for article in articles)
            profile = f"Species: {parrot.species.common_name}; " if parrot and parrot.species else ""
            response = client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[{"role": "system", "content": "Give cautious parrot care information. Never diagnose, prescribe, or advise delaying veterinary care. Treat provided sources as the only citable sources. " + profile + context},
                          {"role": "user", "content": question}],
                max_tokens=500,
            )
            answer = response.choices[0].message.content
            if answer:
                return {"text": answer, "urgent": False, "mode": "llm", "sources": articles}
        except Exception:
            pass

    if articles:
        text = "I don't have enough information to assess this as a diagnosis. Here are relevant care references from the knowledge base. "
        text += "Please contact an avian veterinarian for concerning, persistent, or worsening changes."
    else:
        text = ("I couldn't find a matching article in the current care library, so I won't guess. "
                "For illness, sudden behavior changes, or ongoing concerns, contact an avian veterinarian. "
                "This retrieval-based fallback is not an AI diagnosis.")
    return {"text": text, "urgent": False, "mode": "retrieval-fallback", "sources": articles}


def persist_chat(conversation, question, response):
    Message.objects.create(conversation=conversation, role="user", content=question)
    Message.objects.create(conversation=conversation, role="assistant", content=response["text"], metadata={
        "urgent": response["urgent"], "mode": response["mode"],
        "sources": [{"id": item.id, "title": item.title, "url": item.source_url} for item in response["sources"]],
    })