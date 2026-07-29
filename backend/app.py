from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from recipe_generator import generate_recipe


class GenerateRecipeRequest(BaseModel):
    ingredients: list[str] = Field(..., min_length=1)
    max_new_tokens: int = Field(220, ge=80, le=420)


app = FastAPI(
    title="EnglandCookingHelper RecipeNLG API",
    description="Local RecipeNLG generation service for SmartRecipe.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate-recipe")
def generate_recipe_endpoint(request: GenerateRecipeRequest) -> dict[str, object]:
    try:
        recipe = generate_recipe(
            request.ingredients,
            max_new_tokens=request.max_new_tokens,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"recipe": recipe}
