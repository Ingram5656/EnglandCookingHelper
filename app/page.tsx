"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  getAllIngredients,
  getAllRecipes,
  openRecipeDatabase,
  saveIngredient,
  saveRecipe,
  saveRecipeImage,
  StoredIngredient,
  StoredRecipe,
} from "./database";
import {
  categoryForIngredient,
  INGREDIENT_CATEGORIES,
  Ingredient,
  Recipe,
  SYNONYMS,
} from "./recipes";

type View =
  | "recommend"
  | "categories"
  | "favorites"
  | "recent"
  | "ingredients"
  | "upload";
type SidePanel = "shopping" | "settings" | null;

const DEFAULT_INGREDIENTS = ["鸡蛋", "番茄", "青椒", "土豆", "葱", "大蒜"];
const TEMPLATE = `菜名：红烧鱼
分类：水产
难度：适中
时间：35
份量：2
简介：家常红烧鱼，咸鲜入味，适合配米饭。

食材：
- 鱼 | 1 条 | main | 🐟
- 姜 | 3 片 | seasoning | 🫚
- 葱 | 1 根 | seasoning | 🌿
- 生抽 | 2 勺 | seasoning | 🍶
- 盐 | 适量 | seasoning | 🧂

步骤：
1. 鱼处理干净，擦干表面水分。
2. 热锅放油，将鱼两面煎至微黄。
3. 加入姜、葱、生抽和少量热水。
4. 中火焖煮至汤汁收浓。
5. 加盐调味后出锅。

小贴士：煎鱼前擦干水分，可以减少粘锅。`;

const NAV_ITEMS: Array<{
  id: View | "shopping" | "settings";
  label: string;
  icon: string;
}> = [
  { id: "recommend", label: "首页推荐", icon: "⌂" },
  { id: "categories", label: "菜谱分类", icon: "▦" },
  { id: "favorites", label: "收藏菜谱", icon: "♡" },
  { id: "recent", label: "最近浏览", icon: "◷" },
  { id: "ingredients", label: "食材清单", icon: "♧" },
  { id: "upload", label: "上传菜谱", icon: "＋" },
  { id: "shopping", label: "购物清单", icon: "🛒" },
  { id: "settings", label: "设置", icon: "⚙" },
];

function normalizeIngredient(value: string) {
  const clean = value.trim().replace(/\s+/g, "");
  return SYNONYMS[clean] ?? clean;
}

function scoreRecipe(recipe: Recipe, selectedIngredients: string[]) {
  const selected = new Set(selectedIngredients.map(normalizeIngredient));
  const total = recipe.ingredients.reduce(
    (sum, ingredient) => sum + (ingredient.type === "main" ? 3 : 1),
    0,
  );
  const matched = recipe.ingredients.reduce((sum, ingredient) => {
    if (!selected.has(normalizeIngredient(ingredient.name))) return sum;
    return sum + (ingredient.type === "main" ? 3 : 1);
  }, 0);
  return total ? Math.round((matched / total) * 100) : 0;
}

function idFromName(name: string) {
  const normalized = name.trim().toLowerCase();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `user-${normalized.replace(/[^\p{L}\p{N}]+/gu, "-")}-${suffix}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function valueAfter(label: string, text: string) {
  const match = text.match(new RegExp(`^${label}[：:](.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function blockAfter(label: string, text: string) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${label}：` || line.trim() === `${label}:`);
  if (start < 0) return "";
  const end = lines.findIndex(
    (line, index) => index > start && /^[\u4e00-\u9fa5A-Za-z]+[：:]$/.test(line.trim()),
  );
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n");
}

function parseRecipeTemplate(text: string, imageDataUrl: string): StoredRecipe {
  const name = valueAfter("菜名", text);
  if (!name) throw new Error("模板缺少“菜名”。");

  const ingredientLines = blockAfter("食材", text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const ingredients = ingredientLines.map<Ingredient>((line) => {
    const [rawName, rawAmount, rawType, rawEmoji] = line
      .split("|")
      .map((part) => part.trim());
    if (!rawName) throw new Error("食材行缺少食材名称。");
    return {
      name: normalizeIngredient(rawName),
      amount: rawAmount || "适量",
      type: rawType === "seasoning" ? "seasoning" : "main",
      emoji: rawEmoji || "🥣",
      category: categoryForIngredient(
        normalizeIngredient(rawName),
        rawType === "seasoning" ? "seasoning" : "main",
      ),
    };
  });
  if (!ingredients.length) throw new Error("模板缺少“食材”列表。");

  const steps = blockAfter("步骤", text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+[.、)]\s*/, "").trim())
    .filter(Boolean);
  if (!steps.length) throw new Error("模板缺少“步骤”列表。");

  const now = Date.now();
  return {
    id: idFromName(name),
    name,
    summary: valueAfter("简介", text) || "用户导入的本地菜谱。",
    image: imageDataUrl,
    imageSource: imageDataUrl ? "upload" : "none",
    category: valueAfter("分类", text) || "自定义",
    difficulty:
      valueAfter("难度", text) === "进阶"
        ? "进阶"
        : valueAfter("难度", text) === "适中"
          ? "适中"
          : "简单",
    time: Number(valueAfter("时间", text)) || 20,
    servings: Number(valueAfter("份量", text)) || 2,
    ingredients,
    steps,
    tip: valueAfter("小贴士", text) || "用户导入菜谱。",
    source: "user",
    createdAt: now,
    updatedAt: now,
  };
}

export default function Home() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [ingredients, setIngredients] = useState<StoredIngredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] =
    useState<string[]>(DEFAULT_INGREDIENTS);
  const [ingredientInput, setIngredientInput] = useState("");
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientCategoryFilter, setIngredientCategoryFilter] =
    useState<"全部" | (typeof INGREDIENT_CATEGORIES)[number]>("全部");
  const [timeFilter, setTimeFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState("match");
  const [activeView, setActiveView] = useState<View>("recommend");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [shopping, setShopping] = useState<string[]>([]);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [compactCards, setCompactCards] = useState(false);
  const [templateText, setTemplateText] = useState(TEMPLATE);
  const [uploadImage, setUploadImage] = useState("");
  const [pendingRecipe, setPendingRecipe] = useState<StoredRecipe | null>(null);
  const [pendingMissingIngredients, setPendingMissingIngredients] = useState<
    Ingredient[]
  >([]);
  const [toast, setToast] = useState("");
  const [dbReady, setDbReady] = useState(false);

  async function refreshDatabase(currentDb = db) {
    if (!currentDb) return;
    const [nextRecipes, nextIngredients] = await Promise.all([
      getAllRecipes(currentDb),
      getAllIngredients(currentDb),
    ]);
    setRecipes(nextRecipes.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")));
    setIngredients(
      nextIngredients.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")),
    );
    if (!selectedRecipeId && nextRecipes.length) setSelectedRecipeId(nextRecipes[0].id);
  }

  useEffect(() => {
    openRecipeDatabase().then(async (database) => {
      setDb(database);
      await refreshDatabase(database);
      setDbReady(true);
    });
  }, []);

  useEffect(() => {
    try {
      const storedPantry = localStorage.getItem("smartrecipe-pantry");
      const storedFavorites = localStorage.getItem("smartrecipe-favorites");
      const storedRecent = localStorage.getItem("smartrecipe-recent");
      const storedShopping = localStorage.getItem("smartrecipe-shopping");
      const storedCompact = localStorage.getItem("smartrecipe-compact");
      if (storedPantry) setSelectedIngredients(JSON.parse(storedPantry));
      if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
      if (storedRecent) setRecent(JSON.parse(storedRecent));
      if (storedShopping) setShopping(JSON.parse(storedShopping));
      if (storedCompact) setCompactCards(JSON.parse(storedCompact));
    } catch {
      // Invalid local UI state falls back to defaults.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("smartrecipe-pantry", JSON.stringify(selectedIngredients));
    localStorage.setItem("smartrecipe-favorites", JSON.stringify(favorites));
    localStorage.setItem("smartrecipe-recent", JSON.stringify(recent));
    localStorage.setItem("smartrecipe-shopping", JSON.stringify(shopping));
    localStorage.setItem("smartrecipe-compact", JSON.stringify(compactCards));
  }, [selectedIngredients, favorites, recent, shopping, compactCards]);

  const ingredientEmoji = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.name, item.emoji])),
    [ingredients],
  );
  const ingredientNames = useMemo(
    () => new Set(ingredients.map((item) => normalizeIngredient(item.name))),
    [ingredients],
  );
  const normalizedPantry = useMemo(
    () => selectedIngredients.map(normalizeIngredient),
    [selectedIngredients],
  );

  const scoredRecipes = useMemo(
    () =>
      recipes.map((recipe) => ({
        ...recipe,
        score: scoreRecipe(recipe, selectedIngredients),
      })),
    [recipes, selectedIngredients],
  );

  const visibleRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const recentOrder = new Map(recent.map((id, index) => [id, index]));
    return scoredRecipes
      .filter((recipe) => {
        if (activeView === "favorites" && !favorites.includes(recipe.id)) return false;
        if (activeView === "recent" && !recent.includes(recipe.id)) return false;
        if (
          normalizedQuery &&
          !recipe.name.toLowerCase().includes(normalizedQuery) &&
          !recipe.ingredients.some((item) =>
            item.name.toLowerCase().includes(normalizedQuery),
          )
        )
          return false;
        if (timeFilter !== "all" && recipe.time > Number(timeFilter)) return false;
        if (difficultyFilter !== "all" && recipe.difficulty !== difficultyFilter)
          return false;
        if (categoryFilter !== "all" && recipe.category !== categoryFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (activeView === "recent") {
          return (recentOrder.get(a.id) ?? 99) - (recentOrder.get(b.id) ?? 99);
        }
        if (sortMode === "time") return a.time - b.time;
        if (sortMode === "difficulty") {
          const level = { 简单: 1, 适中: 2, 进阶: 3 };
          return level[a.difficulty] - level[b.difficulty];
        }
        return b.score - a.score;
      });
  }, [
    activeView,
    categoryFilter,
    difficultyFilter,
    favorites,
    query,
    recent,
    scoredRecipes,
    sortMode,
    timeFilter,
  ]);

  useEffect(() => {
    if (
      visibleRecipes.length &&
      !visibleRecipes.some((recipe) => recipe.id === selectedRecipeId)
    ) {
      setSelectedRecipeId(visibleRecipes[0].id);
    }
  }, [visibleRecipes, selectedRecipeId]);

  const selectedRecipe =
    scoredRecipes.find((recipe) => recipe.id === selectedRecipeId) ??
    scoredRecipes[0];
  const matchedIngredients =
    selectedRecipe?.ingredients.filter((item) =>
      normalizedPantry.includes(normalizeIngredient(item.name)),
    ) ?? [];
  const missingIngredients =
    selectedRecipe?.ingredients.filter(
      (item) => !normalizedPantry.includes(normalizeIngredient(item.name)),
    ) ?? [];

  const supportedIngredients = useMemo(() => {
    const normalizedQuery = ingredientQuery.trim().toLowerCase();
    return ingredients.filter(
      (item) =>
        (ingredientCategoryFilter === "全部" ||
          item.category === ingredientCategoryFilter) &&
        (!normalizedQuery ||
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.emoji.includes(normalizedQuery)),
    );
  }, [ingredientCategoryFilter, ingredientQuery, ingredients]);

  const recipesWithoutImage = useMemo(
    () => recipes.filter((recipe) => !recipe.image).length,
    [recipes],
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function addSupportedIngredient(ingredient: Ingredient) {
    if (!db) return;
    await saveIngredient(db, { ...ingredient, source: "user" });
    await refreshDatabase(db);
  }

  function addPantryIngredient(value: string) {
    const ingredient = normalizeIngredient(value);
    if (!ingredient) return;
    if (normalizedPantry.includes(ingredient)) {
      announce("这个食材已经在食材库中了");
      return;
    }
    setSelectedIngredients((current) => [...current, ingredient]);
    setIngredientInput("");
    announce(`已添加 ${ingredient}`);
  }

  function submitIngredient(event: FormEvent) {
    event.preventDefault();
    addPantryIngredient(ingredientInput);
  }

  function openRecipe(id: string) {
    setSelectedRecipeId(id);
    setRecent((current) =>
      [id, ...current.filter((item) => item !== id)].slice(0, 8),
    );
  }

  function toggleFavorite(id: string) {
    const willAdd = !favorites.includes(id);
    setFavorites((current) =>
      willAdd ? [...current, id] : current.filter((item) => item !== id),
    );
    announce(willAdd ? "已收藏菜谱" : "已取消收藏");
  }

  function toggleShopping(name: string) {
    const willAdd = !shopping.includes(name);
    setShopping((current) =>
      willAdd ? [...current, name] : current.filter((item) => item !== name),
    );
    announce(willAdd ? `已把 ${name} 加入购物清单` : `已从清单移除 ${name}`);
  }

  function handleNav(id: (typeof NAV_ITEMS)[number]["id"]) {
    if (id === "shopping" || id === "settings") {
      setSidePanel(id);
      return;
    }
    setSidePanel(null);
    setActiveView(id);
    if (id === "categories") setCategoryFilter("all");
  }

  async function handleRecipeImageChange(
    event: ChangeEvent<HTMLInputElement>,
    recipe: StoredRecipe,
  ) {
    const file = event.target.files?.[0];
    if (!file || !db) return;
    const dataUrl = await fileToDataUrl(file);
    await saveRecipeImage(db, recipe, dataUrl);
    await refreshDatabase(db);
    announce(`已更新 ${recipe.name} 的菜谱图片`);
    event.target.value = "";
  }

  async function handleUploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadImage(await fileToDataUrl(file));
  }

  async function commitRecipeWithIngredients(
    recipe: StoredRecipe,
    missing: Ingredient[],
  ) {
    if (!db) return;
    for (const ingredient of missing) {
      await saveIngredient(db, {
        name: normalizeIngredient(ingredient.name),
        amount: "适量",
        type: ingredient.type,
        emoji: ingredient.emoji || "🥣",
        category:
          ingredient.category ||
          categoryForIngredient(ingredient.name, ingredient.type),
        source: "user",
      });
    }
    await saveRecipe(db, recipe);
    await refreshDatabase(db);
    setTemplateText(TEMPLATE);
    setUploadImage("");
    setPendingRecipe(null);
    setPendingMissingIngredients([]);
    setActiveView("recommend");
    setSelectedRecipeId(recipe.id);
    announce(`已导入 ${recipe.name}`);
  }

  async function submitRecipeTemplate(event: FormEvent) {
    event.preventDefault();
    try {
      const recipe = parseRecipeTemplate(templateText, uploadImage);
      const missing = recipe.ingredients.filter(
        (ingredient) => !ingredientNames.has(normalizeIngredient(ingredient.name)),
      );
      if (missing.length) {
        setPendingRecipe(recipe);
        setPendingMissingIngredients(missing);
        return;
      }
      await commitRecipeWithIngredients(recipe, []);
    } catch (error) {
      announce(error instanceof Error ? error.message : "菜谱模板解析失败");
    }
  }

  const heading =
    activeView === "favorites"
      ? "收藏菜谱"
      : activeView === "recent"
        ? "最近浏览"
        : activeView === "categories"
          ? "菜谱分类"
          : activeView === "ingredients"
            ? "食材清单"
            : activeView === "upload"
              ? "上传菜谱"
              : "推荐菜谱";

  if (!dbReady) {
    return (
      <div className="loading-screen">
        <div className="brand-mark">♨</div>
        <p>正在打开本地菜谱数据库...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            ♨
          </div>
          <div>
            <strong>
              <span>Smart</span>Recipe
            </strong>
            <small>离线食材推荐菜谱</small>
          </div>
        </div>

        <nav className="side-nav" aria-label="主要导航">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeView || item.id === sidePanel;
            return (
              <button
                key={item.id}
                className={isActive ? "active" : ""}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
                {item.id === "shopping" && shopping.length > 0 && (
                  <span className="nav-badge">{shopping.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <span className="note-leaf">☘</span>
          <strong>本地数据库</strong>
          <p>{recipes.length} 道菜谱</p>
          <div className="produce" aria-hidden="true">
            🥬🥕🍅
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SMARTRECIPE · INDEXEDDB</p>
            <h1>
              {heading} <span aria-hidden="true">🌿</span>
            </h1>
            <p>
              菜谱、食材清单和上传图片都保存在当前浏览器的本地数据库
            </p>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索菜谱或食材..."
              aria-label="搜索菜谱或食材"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="清除搜索">
                ×
              </button>
            )}
          </label>
          <div className="profile" title="所有数据保存在本机 IndexedDB">
            <span className="offline-dot" />
            离线数据库
            <span className="avatar">👩🏻‍🍳</span>
          </div>
        </header>

        {activeView !== "ingredients" && activeView !== "upload" && (
          <>
            <section className="pantry-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    我拥有的食材 <span>{selectedIngredients.length}</span>
                  </h2>
                  <p>用当前食材匹配本地数据库里的菜谱</p>
                </div>
                <div className="panel-actions">
                  <button
                    className="ghost-button"
                    onClick={() => setSelectedIngredients([])}
                    disabled={!selectedIngredients.length}
                  >
                    清空
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setActiveView("recommend");
                      setSortMode("match");
                      announce("已按当前食材重新匹配");
                    }}
                  >
                    ✣ 推荐菜谱
                  </button>
                </div>
              </div>

              <div className="ingredient-chips">
                {selectedIngredients.map((ingredient) => (
                  <button
                    className="ingredient-chip"
                    key={ingredient}
                    onClick={() =>
                      setSelectedIngredients((current) =>
                        current.filter((item) => item !== ingredient),
                      )
                    }
                    aria-label={`移除${ingredient}`}
                  >
                    <span>{ingredientEmoji[ingredient] ?? "🥣"}</span>
                    {ingredient}
                    <b>×</b>
                  </button>
                ))}
                <button
                  className="add-chip"
                  onClick={() => setShowIngredientPicker((open) => !open)}
                  aria-expanded={showIngredientPicker}
                >
                  ＋ 添加更多食材
                </button>
              </div>

              {showIngredientPicker && (
                <div className="ingredient-picker">
                  <form onSubmit={submitIngredient}>
                    <input
                      autoFocus
                      value={ingredientInput}
                      onChange={(event) => setIngredientInput(event.target.value)}
                      placeholder="输入食材，例如：豆腐"
                      aria-label="输入食材"
                    />
                    <button className="primary-button" type="submit">
                      添加
                    </button>
                  </form>
                  <div className="suggestion-row">
                    {ingredients
                      .filter(
                        (item) =>
                          item.type === "main" &&
                          !normalizedPantry.includes(normalizeIngredient(item.name)),
                      )
                      .slice(0, 12)
                      .map((item) => (
                        <button
                          key={item.name}
                          onClick={() => addPantryIngredient(item.name)}
                        >
                          {item.emoji} {item.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>

            <div className="toolbar">
              <button
                className={`recommend-pill ${
                  sortMode === "match" ? "active" : ""
                }`}
                onClick={() => setSortMode("match")}
              >
                ☆ 推荐菜谱
              </button>
              <label>
                <span className="sr-only">排序方式</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                >
                  <option value="match">匹配度排序</option>
                  <option value="time">烹饪时间排序</option>
                  <option value="difficulty">难度排序</option>
                </select>
              </label>
              <label>
                <span className="sr-only">烹饪时间</span>
                <select
                  value={timeFilter}
                  onChange={(event) => setTimeFilter(event.target.value)}
                >
                  <option value="all">烹饪时间</option>
                  <option value="10">10 分钟内</option>
                  <option value="15">15 分钟内</option>
                  <option value="20">20 分钟内</option>
                  <option value="30">30 分钟内</option>
                  <option value="45">45 分钟内</option>
                </select>
              </label>
              <label>
                <span className="sr-only">难度</span>
                <select
                  value={difficultyFilter}
                  onChange={(event) => setDifficultyFilter(event.target.value)}
                >
                  <option value="all">全部难度</option>
                  <option value="简单">简单</option>
                  <option value="适中">适中</option>
                  <option value="进阶">进阶</option>
                </select>
              </label>
              <label>
                <span className="sr-only">菜谱分类</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">全部分类</option>
                  {[...new Set(recipes.map((recipe) => recipe.category))].map(
                    (category) => (
                      <option key={category}>{category}</option>
                    ),
                  )}
                </select>
              </label>
              <span className="result-count">
                {visibleRecipes.length} 个结果 · {recipesWithoutImage} 道待上传图片
              </span>
            </div>

            <div className={`workspace ${compactCards ? "compact" : ""}`}>
              <section className="recipe-list" aria-label="菜谱列表">
                {visibleRecipes.length ? (
                  visibleRecipes.map((recipe) => {
                    const matched = recipe.ingredients.filter((item) =>
                      normalizedPantry.includes(normalizeIngredient(item.name)),
                    );
                    const missing = recipe.ingredients.filter(
                      (item) =>
                        !normalizedPantry.includes(normalizeIngredient(item.name)),
                    );
                    return (
                      <article
                        key={recipe.id}
                        className={`recipe-card ${
                          selectedRecipeId === recipe.id ? "selected" : ""
                        }`}
                        onClick={() => openRecipe(recipe.id)}
                      >
                        {recipe.image ? (
                          <img src={recipe.image} alt={recipe.name} />
                        ) : (
                          <div className="no-image">
                            <span>📷</span>
                            <small>待上传</small>
                          </div>
                        )}
                        <div className="card-copy">
                          <div className="card-title-row">
                            <h3>{recipe.name}</h3>
                            <button
                              className={
                                favorites.includes(recipe.id) ? "favorited" : ""
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleFavorite(recipe.id);
                              }}
                              aria-label={`${
                                favorites.includes(recipe.id)
                                  ? "取消收藏"
                                  : "收藏"
                              }${recipe.name}`}
                            >
                              {favorites.includes(recipe.id) ? "★" : "☆"}
                            </button>
                          </div>
                          <p className="card-meta">
                            <span>♧ {recipe.difficulty}</span>
                            <span>◷ {recipe.time} 分钟</span>
                            <span>▤ {recipe.category}</span>
                            <span>{recipe.imageSource === "upload" ? "用户图片" : recipe.image ? "原图" : "无图"}</span>
                          </p>
                          <p className="ingredient-line">
                            <b>已有：</b>
                            {matched.slice(0, 4).map((item) => (
                              <span key={item.name} title={item.name}>
                                {item.emoji}
                              </span>
                            ))}
                            {matched.length > 0 && <i>✓</i>}
                          </p>
                          <p className="ingredient-line missing-line">
                            <b>缺少：</b>
                            {missing.length ? (
                              missing.slice(0, 4).map((item) => (
                                <span key={item.name} title={item.name}>
                                  {item.emoji}
                                </span>
                              ))
                            ) : (
                              <em>食材齐全，可以开做</em>
                            )}
                          </p>
                        </div>
                        <div className="match-score">
                          <small>匹配度</small>
                          <strong>{recipe.score}%</strong>
                          <span
                            className={
                              recipe.score > 80
                                ? "strong"
                                : recipe.score >= 50
                                  ? "medium"
                                  : "low"
                            }
                          >
                            {recipe.score > 80
                              ? "强推荐"
                              : recipe.score >= 50
                                ? "推荐"
                                : "低匹配"}
                          </span>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <span>🥣</span>
                    <h3>暂时没有符合条件的菜谱</h3>
                    <p>试试清除筛选，或再添加一些食材。</p>
                    <button
                      className="primary-button"
                      onClick={() => {
                        setQuery("");
                        setTimeFilter("all");
                        setDifficultyFilter("all");
                        setCategoryFilter("all");
                        setActiveView("recommend");
                      }}
                    >
                      清除筛选
                    </button>
                  </div>
                )}
              </section>

              {selectedRecipe && (
                <aside className="recipe-detail">
                  <div className="detail-heading">
                    <button
                      className={`favorite-large ${
                        favorites.includes(selectedRecipe.id) ? "favorited" : ""
                      }`}
                      onClick={() => toggleFavorite(selectedRecipe.id)}
                      aria-label="收藏当前菜谱"
                    >
                      {favorites.includes(selectedRecipe.id) ? "★" : "☆"}
                    </button>
                    <div>
                      <h2>{selectedRecipe.name}</h2>
                      <p>
                        ♧ {selectedRecipe.difficulty} · ◷ {selectedRecipe.time} 分钟 ·{" "}
                        {selectedRecipe.servings} 人份
                      </p>
                    </div>
                    <div className="detail-score">
                      <small>匹配度</small>
                      <strong>{selectedRecipe.score}%</strong>
                    </div>
                  </div>

                  {selectedRecipe.image ? (
                    <img
                      className="detail-image"
                      src={selectedRecipe.image}
                      alt={selectedRecipe.name}
                    />
                  ) : (
                    <div className="detail-image no-image large">
                      <span>📷</span>
                      <strong>这个菜谱还没有对应图片</strong>
                    </div>
                  )}
                  <label className="image-upload-button">
                    上传/替换这道菜图片
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleRecipeImageChange(event, selectedRecipe)
                      }
                    />
                  </label>
                  <p className="detail-summary">{selectedRecipe.summary}</p>

                  <h3 className="section-title">食材清单</h3>
                  <div className="ingredient-columns">
                    <div className="ingredient-box have">
                      <strong>
                        已拥有 <span>✓</span>
                      </strong>
                      {matchedIngredients.length ? (
                        matchedIngredients.map((item) => (
                          <div key={item.name}>
                            <span>
                              {item.emoji} {item.name}
                            </span>
                            <b>{item.amount}</b>
                          </div>
                        ))
                      ) : (
                        <p>还没有匹配的食材</p>
                      )}
                    </div>
                    <div className="ingredient-box need">
                      <strong>
                        需要补充 <span>🛒</span>
                      </strong>
                      {missingIngredients.length ? (
                        missingIngredients.map((item) => (
                          <button
                            key={item.name}
                            onClick={() => toggleShopping(item.name)}
                            title="加入或移出购物清单"
                          >
                            <span>
                              {shopping.includes(item.name) ? "✓" : item.emoji}{" "}
                              {item.name}
                            </span>
                            <b>{item.amount}</b>
                          </button>
                        ))
                      ) : (
                        <p>食材齐全，可以直接开做</p>
                      )}
                    </div>
                  </div>

                  <h3 className="section-title">制作步骤</h3>
                  <ol className="steps">
                    {selectedRecipe.steps.map((step, index) => (
                      <li key={`${step}-${index}`}>
                        <span>{index + 1}</span>
                        <p>{step}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="cook-tip">
                    <span>💡</span>
                    <p>
                      <strong>厨房小贴士</strong>
                      {selectedRecipe.tip}
                    </p>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}

        {activeView === "ingredients" && (
          <section className="database-panel">
            <div className="database-header">
              <div>
                <h2>支持食材</h2>
                <p>
                  当前本地数据库支持 {ingredients.length} 个食材，每个食材都有 emoji。
                </p>
              </div>
              <label className="search-box compact-search">
                <span aria-hidden="true">⌕</span>
                <input
                  value={ingredientQuery}
                  onChange={(event) => setIngredientQuery(event.target.value)}
                  placeholder="搜索食材..."
                />
              </label>
            </div>
            <div className="ingredient-category-tabs" aria-label="食材分类">
              {(["全部", ...INGREDIENT_CATEGORIES] as const).map((category) => (
                <button
                  key={category}
                  className={
                    ingredientCategoryFilter === category ? "active" : ""
                  }
                  onClick={() => setIngredientCategoryFilter(category)}
                >
                  {category}
                  <span>
                    {category === "全部"
                      ? ingredients.length
                      : ingredients.filter((item) => item.category === category)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <div className="ingredient-grid">
              {supportedIngredients.map((ingredient) => (
                <button
                  key={ingredient.name}
                  className="ingredient-record"
                  onClick={() => addPantryIngredient(ingredient.name)}
                >
                  <span>{ingredient.emoji}</span>
                  <strong>{ingredient.name}</strong>
                  <small>
                    {ingredient.category} ·{" "}
                    {ingredient.type === "main" ? "主料" : "调料"}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )}

        {activeView === "upload" && (
          <section className="database-panel upload-panel">
            <div className="database-header">
              <div>
                <h2>上传菜谱</h2>
                <p>按模板输入菜谱，可一键导入到本地 IndexedDB 数据库。</p>
              </div>
              <button className="ghost-button" onClick={() => setTemplateText(TEMPLATE)}>
                恢复模板
              </button>
            </div>
            <form className="upload-form" onSubmit={submitRecipeTemplate}>
              <label className="upload-image-box">
                {uploadImage ? (
                  <img src={uploadImage} alt="待导入菜谱图片预览" />
                ) : (
                  <span>上传菜谱图片</span>
                )}
                <input type="file" accept="image/*" onChange={handleUploadImage} />
              </label>
              <div className="template-editor">
                <div className="template-note">
                  食材行格式：名称 | 用量 | main 或 seasoning | emoji
                </div>
                <textarea
                  value={templateText}
                  onChange={(event) => setTemplateText(event.target.value)}
                  spellCheck={false}
                />
                <button className="primary-button" type="submit">
                  一键导入菜谱
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      {pendingRecipe && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>发现新食材</h2>
            <p>
              这些食材还不在食材清单中。确认后会先加入食材数据库，再导入菜谱。
            </p>
            <div className="pending-ingredients">
              {pendingMissingIngredients.map((ingredient) => (
                <span key={ingredient.name}>
                  {ingredient.emoji || "🥣"} {ingredient.name}
                </span>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setPendingRecipe(null);
                  setPendingMissingIngredients([]);
                }}
              >
                返回修改
              </button>
              <button
                className="primary-button"
                onClick={() =>
                  commitRecipeWithIngredients(
                    pendingRecipe,
                    pendingMissingIngredients,
                  )
                }
              >
                添加食材并导入
              </button>
            </div>
          </div>
        </div>
      )}

      {sidePanel && (
        <>
          <button
            className="drawer-backdrop"
            onClick={() => setSidePanel(null)}
            aria-label="关闭侧边面板"
          />
          <aside className="drawer">
            <div className="drawer-heading">
              <div>
                <p>SMARTRECIPE</p>
                <h2>{sidePanel === "shopping" ? "购物清单" : "本地设置"}</h2>
              </div>
              <button onClick={() => setSidePanel(null)} aria-label="关闭">
                ×
              </button>
            </div>
            {sidePanel === "shopping" ? (
              <>
                <p className="drawer-intro">
                  从菜谱缺少食材中添加，清单保存在当前设备。
                </p>
                <div className="shopping-list">
                  {shopping.length ? (
                    shopping.map((item) => (
                      <label key={item}>
                        <input
                          type="checkbox"
                          onChange={() => toggleShopping(item)}
                        />
                        <span>{ingredientEmoji[item] ?? "🥣"}</span>
                        <b>{item}</b>
                        <button
                          onClick={() => toggleShopping(item)}
                          aria-label={`删除${item}`}
                        >
                          ×
                        </button>
                      </label>
                    ))
                  ) : (
                    <div className="drawer-empty">
                      <span>🧺</span>
                      <strong>购物清单还是空的</strong>
                      <p>在菜谱详情中点击缺少的食材即可添加。</p>
                    </div>
                  )}
                </div>
                {shopping.length > 0 && (
                  <button
                    className="ghost-button full"
                    onClick={() => setShopping([])}
                  >
                    清空购物清单
                  </button>
                )}
              </>
            ) : (
              <div className="settings-list">
                <label>
                  <span>
                    <strong>紧凑菜谱卡片</strong>
                    <small>在列表中展示更多内容</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={compactCards}
                    onChange={(event) => setCompactCards(event.target.checked)}
                  />
                </label>
                <div className="privacy-card">
                  <span>✓</span>
                  <p>
                    <strong>本地数据库</strong>
                    菜谱、食材和上传图片使用 IndexedDB；偏好设置保存在当前设备。
                  </p>
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
