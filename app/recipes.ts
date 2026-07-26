import ingredientDatabase from "./ingredient-database.json";
import generatedRecipes from "./generated-recipes.json";

export const INGREDIENT_CATEGORIES = ["主食", "蔬菜", "肉类", "海鲜", "调料"] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export type Ingredient = {
  name: string;
  amount: string;
  type: "main" | "seasoning";
  emoji: string;
  category: IngredientCategory;
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
  source?: "seed" | "user";
  imageSource?: "seed" | "upload" | "none";
};

type StoredRecipe = Omit<Recipe, "image"> & {
  image: string;
};

const recipeAsset = (fileName: string) =>
  `${import.meta.env.BASE_URL}${fileName}`;

function normalizeIngredientRecord(ingredient: Ingredient): Ingredient {
  return {
    ...ingredient,
    category: INGREDIENT_CATEGORIES.includes(ingredient.category)
      ? ingredient.category
      : "调料",
    type: ingredient.type === "seasoning" ? "seasoning" : "main",
  };
}

export const INGREDIENT_DATABASE: Ingredient[] = (
  ingredientDatabase as Ingredient[]
).map(normalizeIngredientRecord);

const ingredientCatalog = new Map(
  INGREDIENT_DATABASE.map((ingredient) => [ingredient.name, ingredient]),
);

export const RECIPES: Recipe[] = (generatedRecipes as StoredRecipe[]).map(
  (recipe) => ({
    ...recipe,
    image: recipe.image ? recipeAsset(recipe.image) : "",
    ingredients: recipe.ingredients.map((ingredient) =>
      normalizeIngredientRecord(ingredient),
    ),
    source: "seed",
    imageSource: recipe.image ? "seed" : "none",
  }),
);

const seasoningPattern =
  /盐|糖|油|醋|酱|生抽|老抽|蚝油|料酒|鸡精|味精|胡椒|花椒|八角|桂皮|香叶|淀粉|孜然|辣椒粉|香油|耗油|酒|茶|咖啡|奶油|黄油|蜂蜜/;

export function categoryForIngredient(
  name: string,
  type: Ingredient["type"] = "main",
): IngredientCategory {
  const existing = ingredientCatalog.get(name);
  if (existing) return existing.category;
  if (seasoningPattern.test(name) || type === "seasoning") return "调料";
  if (/虾|鱼|蟹|贝|蛏|蛤|蚝|鲍|鱿|章鱼|海参|海带|紫菜|鳗|鳕|鲈|鲤|鲫|鳊|黄鱼|罗氏/.test(name))
    return "海鲜";
  if (/猪|牛|羊|鸡|鸭|鹅|蛋|肉|排骨|里脊|五花|火腿|培根|香肠|腊肠|鸡翅|鸡腿|鸭血|午餐肉/.test(name))
    return "肉类";
  if (/米|饭|面|粉|粉丝|粉条|馒头|包子|饺|馄饨|饼|粥|燕麦|荞麦|意面|通心粉|年糕|吐司|面包|薯条/.test(name))
    return "主食";
  if (/菜|萝卜|白菜|生菜|菠菜|芹菜|青椒|辣椒|番茄|土豆|茄子|黄瓜|西葫芦|洋葱|葱|姜|蒜|蘑菇|香菇|豆腐|豆芽|玉米|莲藕|冬瓜|南瓜|莴笋|韭菜|西兰花|花菜|包菜|娃娃菜|油麦|香菜|薄荷|果|梨|橙|柠檬|苹果|香蕉|草莓|百香果/.test(name))
    return "蔬菜";
  return "调料";
}

export const SEED_VERSION = `excel-manual-${RECIPES.length}-${INGREDIENT_DATABASE.length}-v1`;

export const INGREDIENT_EMOJI: Record<string, string> = Object.fromEntries(
  INGREDIENT_DATABASE.map((ingredient) => [ingredient.name, ingredient.emoji]),
);

export const INGREDIENT_SUGGESTIONS = INGREDIENT_DATABASE.filter(
  (ingredient) => ingredient.type === "main",
)
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
  芝麻香油: "芝麻油",
  香油: "芝麻油",
  麻油: "芝麻油",
  耗油: "蚝油",
  食盐: "盐",
  食用盐: "盐",
  盐巴: "盐",
  精盐: "盐",
  白糖: "糖",
  白砂糖: "糖",
};
