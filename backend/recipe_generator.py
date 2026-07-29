"""RecipeNLG model integration.

The generator is loaded lazily so the FastAPI service can start even before the
large HuggingFace/PyTorch model is downloaded. If the model cannot be loaded,
the module returns a structured fallback recipe instead of an empty response.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

MODEL_NAME = "mbien/recipenlg"
MAX_NEW_TOKENS = 220


class RecipeGenerationError(RuntimeError):
    """Raised when RecipeNLG cannot produce a usable recipe."""


def _clean_ingredients(ingredients: list[str]) -> list[str]:
    cleaned: list[str] = []
    for ingredient in ingredients:
        name = re.sub(r"\s+", " ", ingredient).strip(" ,.;")
        if name and name.lower() not in {item.lower() for item in cleaned}:
            cleaned.append(name)
    return cleaned


def _fallback_recipe(ingredients: list[str], reason: str | None = None) -> dict[str, Any]:
    title_core = ", ".join(item.title() for item in ingredients[:3])
    title = f"{title_core} Skillet" if title_core else "AI Generated Skillet"
    main = ingredients or ["seasonal vegetables"]
    return {
        "title": title,
        "ingredients": [
            {"name": ingredient, "amount": "to taste", "type": "main"}
            for ingredient in main
        ]
        + [
            {"name": "salt", "amount": "to taste", "type": "seasoning"},
            {"name": "black pepper", "amount": "to taste", "type": "seasoning"},
            {"name": "olive oil", "amount": "1 tablespoon", "type": "seasoning"},
        ],
        "steps": [
            "Prepare and cut all ingredients into even pieces.",
            "Heat olive oil in a pan over medium heat.",
            "Add the main ingredients and cook until lightly browned.",
            "Season with salt and black pepper, then stir until evenly coated.",
            "Cook until the ingredients are tender and serve warm.",
        ],
        "time": "30 minutes",
        "difficulty": "easy",
        "source": "AI Generated",
        "model": MODEL_NAME,
        "fallback_reason": reason,
    }


def _prompt_from_ingredients(ingredients: list[str]) -> str:
    return (
        "Generate a complete cooking recipe.\n"
        f"Ingredients: {', '.join(ingredients)}\n"
        "Return title, ingredients, and numbered instructions.\n"
        "Recipe:"
    )


@lru_cache(maxsize=1)
def _load_model() -> tuple[Any, Any, str]:
    from transformers import AutoModelForCausalLM, AutoModelForSeq2SeqLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    try:
        model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
        model_kind = "seq2seq"
    except Exception:
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        model_kind = "causal"
    return tokenizer, model, model_kind


def _generate_text(ingredients: list[str], max_new_tokens: int) -> str:
    tokenizer, model, model_kind = _load_model()
    prompt = _prompt_from_ingredients(ingredients)
    encoded = tokenizer(prompt, return_tensors="pt", truncation=True)
    output_ids = model.generate(
        **encoded,
        max_new_tokens=max_new_tokens,
        num_beams=4,
        no_repeat_ngram_size=3,
        early_stopping=True,
        pad_token_id=getattr(tokenizer, "eos_token_id", None),
    )
    if model_kind == "causal":
        output_ids = output_ids[:, encoded["input_ids"].shape[-1] :]
    return tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()


def _split_generated_text(text: str) -> dict[str, Any]:
    lines = [line.strip(" \t-") for line in text.splitlines() if line.strip()]
    if not lines:
        raise RecipeGenerationError("RecipeNLG returned empty text.")

    title = lines[0]
    title = re.sub(r"^(title|recipe name)\s*[:\-]\s*", "", title, flags=re.I).strip()
    ingredient_lines: list[str] = []
    steps: list[str] = []
    section = ""

    for line in lines[1:]:
        lowered = line.lower()
        if lowered.startswith(("ingredients:", "ingredient:")):
            section = "ingredients"
            line = re.sub(r"^ingredients?\s*:\s*", "", line, flags=re.I).strip()
        elif lowered.startswith(("instructions:", "directions:", "steps:", "method:")):
            section = "steps"
            line = re.sub(
                r"^(instructions|directions|steps|method)\s*:\s*",
                "",
                line,
                flags=re.I,
            ).strip()

        if not line:
            continue
        if section == "ingredients":
            ingredient_lines.extend(
                item.strip(" ,.;") for item in re.split(r";|,(?=\s*[A-Za-z])", line)
            )
        else:
            step = re.sub(r"^\d+[\).、]\s*", "", line).strip()
            if step:
                steps.append(step)

    ingredient_lines = [item for item in ingredient_lines if item]
    if not ingredient_lines:
        ingredient_lines = []
    if not steps:
        steps = [
            re.sub(r"^\d+[\).、]\s*", "", line).strip()
            for line in lines[1:]
            if len(line) > 12
        ]

    if not title or not steps:
        raise RecipeGenerationError("RecipeNLG output could not be parsed.")

    return {
        "title": title,
        "ingredients": [
            {"name": item, "amount": "to taste", "type": "main"}
            for item in ingredient_lines
        ],
        "steps": steps[:8],
        "time": "30 minutes",
        "difficulty": "medium",
        "source": "AI Generated",
        "model": MODEL_NAME,
    }


def generate_recipe(
    ingredients: list[str],
    max_new_tokens: int = MAX_NEW_TOKENS,
) -> dict[str, Any]:
    """Generate a structured recipe from a list of ingredient names."""

    cleaned = _clean_ingredients(ingredients)
    if not cleaned:
        raise ValueError("ingredients must contain at least one item")

    try:
        text = _generate_text(cleaned, max_new_tokens=max_new_tokens)
        recipe = _split_generated_text(text)
        if not recipe["ingredients"]:
            recipe["ingredients"] = [
                {"name": item, "amount": "to taste", "type": "main"}
                for item in cleaned
            ]
        return recipe
    except Exception as exc:
        return _fallback_recipe(cleaned, reason=str(exc))
