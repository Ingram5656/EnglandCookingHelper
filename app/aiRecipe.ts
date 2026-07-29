import { categoryForIngredient, Ingredient, Recipe } from "./recipes";

type ApiIngredient =
  | string
  | {
      name?: string;
      amount?: string;
      type?: string;
      emoji?: string;
      category?: Ingredient["category"];
    };

type ApiRecipe = {
  title?: string;
  name?: string;
  ingredients?: ApiIngredient[];
  steps?: string[];
  time?: string | number;
  difficulty?: string;
  source?: string;
};

type GenerateRecipeResponse = {
  recipe?: ApiRecipe;
};

const API_BASE_URL =
  import.meta.env.VITE_RECIPE_API_URL ?? "http://127.0.0.1:8000";

const FALLBACK_EMOJI: Record<string, string> = {
  chicken: "🍗",
  potato: "🥔",
  onion: "🧅",
  egg: "🥚",
  tomato: "🍅",
  rice: "🍚",
  beef: "🥩",
  fish: "🐟",
  shrimp: "🦐",
  garlic: "🧄",
};

function titleFromIngredients(ingredients: string[]) {
  const clean = ingredients.filter(Boolean);
  return clean.length ? `${clean.join(" + ")} AI Recipe` : "AI Generated Recipe";
}

function idFromTitle(title: string) {
  return `ai-${title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")}-${Date.now()}`;
}

function normalizeApiIngredient(item: ApiIngredient): Ingredient {
  const name = typeof item === "string" ? item.trim() : item.name?.trim() ?? "";
  const amount =
    typeof item === "string" ? "适量" : item.amount?.trim() || "适量";
  const type = typeof item === "string" ? "main" : item.type;
  const normalizedType = type === "seasoning" ? "seasoning" : "main";
  const emoji =
    typeof item === "string"
      ? FALLBACK_EMOJI[name.toLowerCase()] ?? "🥣"
      : item.emoji || FALLBACK_EMOJI[name.toLowerCase()] || "🥣";
  return {
    name,
    amount,
    type: normalizedType,
    emoji,
    category:
      typeof item === "string" || !item.category
        ? categoryForIngredient(name, normalizedType)
        : item.category,
  };
}

function normalizeDifficulty(value: string | undefined): Recipe["difficulty"] {
  if (value === "进阶" || value?.toLowerCase() === "hard") return "进阶";
  if (value === "适中" || value?.toLowerCase() === "medium") return "适中";
  return "简单";
}

function normalizeTime(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export async function generateAiRecipe(
  ingredients: string[],
): Promise<Recipe> {
  const normalizedIngredients = ingredients
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
  if (!normalizedIngredients.length) {
    throw new Error("请先添加至少一个食材。");
  }

  const response = await fetch(`${API_BASE_URL}/generate-recipe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ingredients: normalizedIngredients }),
  });
  if (!response.ok) {
    throw new Error(`RecipeNLG API 返回 ${response.status}`);
  }

  const payload = (await response.json()) as GenerateRecipeResponse;
  const recipe = payload.recipe;
  const title = (recipe?.title || recipe?.name || "").trim();
  const steps = recipe?.steps?.map((step) => step.trim()).filter(Boolean) ?? [];
  const apiIngredients =
    recipe?.ingredients?.map(normalizeApiIngredient).filter((item) => item.name) ??
    [];

  if (!title || !apiIngredients.length || !steps.length) {
    throw new Error("RecipeNLG API 返回了空菜谱。");
  }

  return {
    id: idFromTitle(title),
    name: title,
    summary: `根据 ${normalizedIngredients.join("、")} 生成的 AI 菜谱。`,
    image: "",
    imageSource: "none",
    category: "AI Creation",
    difficulty: normalizeDifficulty(recipe?.difficulty),
    time: normalizeTime(recipe?.time),
    servings: 2,
    ingredients: apiIngredients,
    steps,
    tip: "AI 生成菜谱需按实际食材状态和厨房安全常识复核后再烹饪。",
    source: "ai",
  };
}

export function fallbackAiRecipeTitle(ingredients: string[]) {
  return titleFromIngredients(ingredients);
}
