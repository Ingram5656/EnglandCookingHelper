import generatedRecipes from "./generated-recipes.json";

export type Ingredient = {
  name: string;
  amount: string;
  type: "main" | "seasoning";
  emoji: string;
};

export type Recipe = {
  id: string;
  name: string;
  summary: string;
  image: string;
  category: string;
  difficulty: "简单" | "适中" | "进阶";
  time: number;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  tip: string;
};

type StoredRecipe = Omit<Recipe, "image"> & {
  image: string;
};

const recipeAsset = (fileName: string) =>
  `${import.meta.env.BASE_URL}${fileName}`;

export const RECIPES: Recipe[] = (generatedRecipes as StoredRecipe[]).map(
  (recipe) => ({
    ...recipe,
    image: recipeAsset(recipe.image),
  }),
);

const ingredientFrequency = RECIPES.reduce<Map<string, Ingredient>>(
  (map, recipe) => {
    for (const ingredient of recipe.ingredients) {
      if (!map.has(ingredient.name)) map.set(ingredient.name, ingredient);
    }
    return map;
  },
  new Map(),
);

export const INGREDIENT_EMOJI: Record<string, string> = Object.fromEntries(
  [...ingredientFrequency.values()].map((ingredient) => [
    ingredient.name,
    ingredient.emoji,
  ]),
);

export const INGREDIENT_SUGGESTIONS = [...ingredientFrequency.values()]
  .filter((ingredient) => ingredient.type === "main")
  .slice(0, 80)
  .map((ingredient) => ingredient.name);

export const SYNONYMS: Record<string, string> = {
  西红柿: "番茄",
  小葱: "葱",
  香葱: "葱",
  蒜: "大蒜",
  蒜瓣: "大蒜",
  马铃薯: "土豆",
  洋芋: "土豆",
  青瓜: "黄瓜",
  鸡蛋液: "鸡蛋",
};
