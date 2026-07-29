import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceJson =
  process.argv[2] ?? "D:/xiachufang_top_recipes_crawler_v4/home_recipes.json";
const sourceImageRoot =
  process.argv[3] ?? "D:/xiachufang_top_recipes_crawler_v4/howtocook";
const generatedRecipesPath = path.join(projectRoot, "app/generated-recipes.json");
const ingredientDatabasePath = path.join(projectRoot, "app/ingredient-database.json");
const publicImageRoot = path.join(projectRoot, "public/xiachufang");

const validCategories = new Set(["主食", "蔬菜", "肉类", "海鲜", "调料"]);
const difficultyMap = new Map([
  ["简单", "简单"],
  ["中等", "适中"],
  ["适中", "适中"],
  ["困难", "进阶"],
  ["进阶", "进阶"],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function stripNoise(value) {
  return String(value ?? "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/^\s*(?:约|大约|大概)?(?:\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(?:个|只|颗|枚|勺|大勺|小勺|汤匙|茶匙|克|g|kg|ml|毫升|升|片|块|根|把|瓣|碗|杯|包|袋|盒|罐|听|滴|撮|枝|朵|节|条|张|份|支|斤|两)\s*/i, "")
    .replace(/^(?:适量|少许|若干|一个|一只|一颗|一枚|一根|一把|一包|一袋|一盒|一罐|一听|半个|半只|半根)\s*/i, "")
    .replace(/^(?:新鲜|熟|生|干|老|嫩|小|大)\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

function extractAmount(rawName, fallbackAmount) {
  const raw = String(rawName ?? "").trim();
  const match = raw.match(
    /^\s*((?:约|大约|大概)?(?:\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(?:个|只|颗|枚|勺|大勺|小勺|汤匙|茶匙|克|g|kg|ml|毫升|升|片|块|根|把|瓣|碗|杯|包|袋|盒|罐|听|滴|撮|枝|朵|节|条|张|份|支|斤|两))/i,
  );
  return match?.[1]?.trim() || fallbackAmount || "适量";
}

function normalizeCategory(category, type) {
  if (validCategories.has(category)) return category;
  if (category === "调味料" || type === "seasoning") return "调料";
  if (category === "水产") return "海鲜";
  if (category === "蛋奶" || category === "肉类") return "肉类";
  if (category === "豆制品" || category === "菌菇" || category === "水果") return "蔬菜";
  return type === "seasoning" ? "调料" : "蔬菜";
}

function buildCatalog() {
  const ingredients = readJson(ingredientDatabasePath);
  const byName = new Map(ingredients.map((item) => [item.name, item]));
  const searchable = [...ingredients]
    .filter((item) => item.name.length >= 2)
    .sort((a, b) => b.name.length - a.name.length);
  return { byName, searchable };
}

function findCatalogIngredient(rawName, catalog) {
  const clean = stripNoise(rawName);
  if (catalog.byName.has(clean)) return catalog.byName.get(clean);
  if (catalog.byName.has(rawName)) return catalog.byName.get(rawName);
  return catalog.searchable.find(
    (item) => clean.includes(item.name) || String(rawName).includes(item.name),
  );
}

function normalizeIngredient(ingredient, catalog) {
  const match = findCatalogIngredient(ingredient.name, catalog);
  if (match) {
    return {
      name: match.name,
      amount: extractAmount(ingredient.name, ingredient.amount),
      type: match.type,
      emoji: match.emoji,
      category: match.category,
    };
  }
  const type = ingredient.type === "seasoning" ? "seasoning" : "main";
  return {
    name: stripNoise(ingredient.name) || ingredient.name || "未知食材",
    amount: extractAmount(ingredient.name, ingredient.amount),
    type,
    emoji: ingredient.emoji || "🥣",
    category: normalizeCategory(ingredient.category, type),
  };
}

function dedupeIngredients(ingredients) {
  const merged = new Map();
  for (const ingredient of ingredients) {
    if (!ingredient.name) continue;
    if (!merged.has(ingredient.name)) {
      merged.set(ingredient.name, ingredient);
      continue;
    }
    const existing = merged.get(ingredient.name);
    if (existing.amount === "适量" && ingredient.amount !== "适量") {
      merged.set(ingredient.name, ingredient);
    }
  }
  return [...merged.values()];
}

function normalizeSteps(steps) {
  const joined = steps
    .map((step) => String(step ?? "").trim())
    .filter(Boolean)
    .join(",");
  const normalized = joined
    .replace(/\r?\n/g, ",")
    .replace(/\s+/g, " ")
    .replace(/，(?=\d+[.、])/g, ",");
  const split = normalized
    .split(/(?:^|,)\s*\d+[.、]\s*/)
    .map((step) => step.replace(/^[-–—]\s*/, "").trim(" ,;，；"))
    .filter((step) => step.length > 1);
  if (split.length >= 2) return split;
  return steps
    .map((step) => String(step ?? "").replace(/^\d+[.、]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeRecipe(recipe, catalog) {
  const imageFile = path.basename(recipe.image || `${recipe.id}.jpg`);
  const sourceImage = path.join(sourceImageRoot, imageFile);
  const image = fs.existsSync(sourceImage) ? `xiachufang/${imageFile}` : "";
  if (image) {
    fs.mkdirSync(publicImageRoot, { recursive: true });
    fs.copyFileSync(sourceImage, path.join(publicImageRoot, imageFile));
  }

  return {
    id: recipe.id,
    name: recipe.name,
    summary: recipe.summary || `${recipe.name}是一道来自下厨房的家常菜谱。`,
    image,
    category: recipe.category || "家常菜",
    difficulty: difficultyMap.get(recipe.difficulty) ?? "适中",
    time: Number(recipe.time) > 0 ? Number(recipe.time) : 30,
    servings: Number(recipe.servings) > 0 ? Number(recipe.servings) : 2,
    ingredients: dedupeIngredients(
      (recipe.ingredients || []).map((ingredient) =>
        normalizeIngredient(ingredient, catalog),
      ),
    ),
    steps: normalizeSteps(recipe.steps || []),
    tip: recipe.tip || "来自下厨房公开菜谱，烹饪时请根据实际食材状态调整火候和调味。",
  };
}

const catalog = buildCatalog();
const sourceRecipes = readJson(sourceJson);
const existingRecipes = readJson(generatedRecipesPath);
const byId = new Map(existingRecipes.map((recipe) => [recipe.id, recipe]));

let imported = 0;
for (const recipe of sourceRecipes) {
  if (!recipe?.id || !recipe?.name) continue;
  byId.set(recipe.id, normalizeRecipe(recipe, catalog));
  imported += 1;
}

const mergedRecipes = [...byId.values()].sort((a, b) =>
  a.id.localeCompare(b.id, "zh-Hans-CN"),
);
writeJson(generatedRecipesPath, mergedRecipes);

console.log(
  `Imported ${imported} Xiachufang recipes; generated recipe database now has ${mergedRecipes.length} recipes.`,
);
