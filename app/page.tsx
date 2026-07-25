"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  INGREDIENT_EMOJI,
  INGREDIENT_SUGGESTIONS,
  RECIPES,
  Recipe,
  SYNONYMS,
} from "./recipes";

type View = "recommend" | "categories" | "favorites" | "recent";
type SidePanel = "shopping" | "settings" | null;

const DEFAULT_INGREDIENTS = ["鸡蛋", "番茄", "青椒", "土豆", "葱", "大蒜"];

const NAV_ITEMS: Array<{
  id: View | "pantry" | "shopping" | "settings";
  label: string;
  icon: string;
}> = [
  { id: "recommend", label: "首页推荐", icon: "⌂" },
  { id: "categories", label: "菜谱分类", icon: "▦" },
  { id: "favorites", label: "收藏菜谱", icon: "♡" },
  { id: "recent", label: "最近浏览", icon: "◷" },
  { id: "pantry", label: "食材管理", icon: "♧" },
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
  return Math.round((matched / total) * 100);
}

export default function Home() {
  const [selectedIngredients, setSelectedIngredients] =
    useState<string[]>(DEFAULT_INGREDIENTS);
  const [ingredientInput, setIngredientInput] = useState("");
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState("match");
  const [activeView, setActiveView] = useState<View>("recommend");
  const [selectedRecipeId, setSelectedRecipeId] = useState(RECIPES[0].id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [shopping, setShopping] = useState<string[]>([]);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [compactCards, setCompactCards] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const pantryRef = useRef<HTMLElement>(null);

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
      // Invalid local data falls back to the safe defaults above.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      "smartrecipe-pantry",
      JSON.stringify(selectedIngredients),
    );
    localStorage.setItem("smartrecipe-favorites", JSON.stringify(favorites));
    localStorage.setItem("smartrecipe-recent", JSON.stringify(recent));
    localStorage.setItem("smartrecipe-shopping", JSON.stringify(shopping));
    localStorage.setItem("smartrecipe-compact", JSON.stringify(compactCards));
  }, [
    hydrated,
    selectedIngredients,
    favorites,
    recent,
    shopping,
    compactCards,
  ]);

  const normalizedPantry = useMemo(
    () => selectedIngredients.map(normalizeIngredient),
    [selectedIngredients],
  );

  const scoredRecipes = useMemo(
    () =>
      RECIPES.map((recipe) => ({
        ...recipe,
        score: scoreRecipe(recipe, selectedIngredients),
      })),
    [selectedIngredients],
  );

  const visibleRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const recentOrder = new Map(recent.map((id, index) => [id, index]));

    return scoredRecipes
      .filter((recipe) => {
        if (activeView === "favorites" && !favorites.includes(recipe.id))
          return false;
        if (activeView === "recent" && !recent.includes(recipe.id)) return false;
        if (
          normalizedQuery &&
          !recipe.name.toLowerCase().includes(normalizedQuery) &&
          !recipe.ingredients.some((item) =>
            item.name.toLowerCase().includes(normalizedQuery),
          )
        )
          return false;
        if (timeFilter !== "all" && recipe.time > Number(timeFilter))
          return false;
        if (
          difficultyFilter !== "all" &&
          recipe.difficulty !== difficultyFilter
        )
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
    scoredRecipes,
    activeView,
    favorites,
    recent,
    query,
    timeFilter,
    difficultyFilter,
    categoryFilter,
    sortMode,
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
  const matchedIngredients = selectedRecipe.ingredients.filter((item) =>
    normalizedPantry.includes(normalizeIngredient(item.name)),
  );
  const missingIngredients = selectedRecipe.ingredients.filter(
    (item) => !normalizedPantry.includes(normalizeIngredient(item.name)),
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function addIngredient(value: string) {
    const ingredient = normalizeIngredient(value);
    if (!ingredient) return;
    if (normalizedPantry.includes(normalizeIngredient(ingredient))) {
      announce("这个食材已经在食材库中了");
      return;
    }
    setSelectedIngredients((current) => [...current, ingredient]);
    setIngredientInput("");
    announce(`已添加 ${ingredient}`);
  }

  function submitIngredient(event: FormEvent) {
    event.preventDefault();
    addIngredient(ingredientInput);
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
    if (id === "pantry") {
      setSidePanel(null);
      pantryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setShowIngredientPicker(true);
      return;
    }
    if (id === "shopping" || id === "settings") {
      setSidePanel(id);
      return;
    }
    setSidePanel(null);
    setActiveView(id);
    if (id === "categories") setCategoryFilter("all");
  }

  const heading =
    activeView === "favorites"
      ? "收藏菜谱"
      : activeView === "recent"
        ? "最近浏览"
        : activeView === "categories"
          ? "菜谱分类"
          : "推荐菜谱";

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
            const isActive =
              item.id === activeView ||
              item.id === sidePanel ||
              (item.id === "pantry" && showIngredientPicker);
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
          <strong>用现有食材</strong>
          <p>发现更多美味</p>
          <div className="produce" aria-hidden="true">
            🥬🥕🍅
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SMARTRECIPE · LOCAL</p>
            <h1>
              {heading} <span aria-hidden="true">🌿</span>
            </h1>
            <p>选择你拥有的食材，智能推荐适合的本地菜谱</p>
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
          <div className="profile" title="所有数据仅保存在本机">
            <span className="offline-dot" />
            离线模式
            <span className="avatar">👩🏻‍🍳</span>
          </div>
        </header>

        <section className="pantry-panel" ref={pantryRef}>
          <div className="panel-heading">
            <div>
              <h2>
                我拥有的食材 <span>{selectedIngredients.length}</span>
              </h2>
              <p>主料权重更高，调料也会参与匹配</p>
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
                <span>{INGREDIENT_EMOJI[ingredient] ?? "🥣"}</span>
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
                {INGREDIENT_SUGGESTIONS.filter(
                  (item) =>
                    !normalizedPantry.includes(normalizeIngredient(item)),
                )
                  .slice(0, 9)
                  .map((item) => (
                    <button key={item} onClick={() => addIngredient(item)}>
                      {INGREDIENT_EMOJI[item] ?? "🥣"} {item}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>

        <div className="toolbar">
          <button
            className={`recommend-pill ${sortMode === "match" ? "active" : ""}`}
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
              {[...new Set(RECIPES.map((recipe) => recipe.category))].map(
                (category) => (
                  <option key={category}>{category}</option>
                ),
              )}
            </select>
          </label>
          <span className="result-count">{visibleRecipes.length} 个结果</span>
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
                    <img src={recipe.image} alt={recipe.name} />
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
                            favorites.includes(recipe.id) ? "取消收藏" : "收藏"
                          }${recipe.name}`}
                        >
                          {favorites.includes(recipe.id) ? "★" : "☆"}
                        </button>
                      </div>
                      <p className="card-meta">
                        <span>♧ {recipe.difficulty}</span>
                        <span>◷ {recipe.time} 分钟</span>
                        <span>▤ {recipe.category}</span>
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
                  ♧ {selectedRecipe.difficulty} · ◷ {selectedRecipe.time} 分钟 ·
                  &nbsp;{selectedRecipe.servings} 人份
                </p>
              </div>
              <div className="detail-score">
                <small>匹配度</small>
                <strong>{selectedRecipe.score}%</strong>
              </div>
            </div>
            <img
              className="detail-image"
              src={selectedRecipe.image}
              alt={selectedRecipe.name}
            />
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
                <li key={step}>
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
        </div>
      </main>

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
                  从菜谱缺少食材中添加，清单只保存在这台设备。
                </p>
                <div className="shopping-list">
                  {shopping.length ? (
                    shopping.map((item) => (
                      <label key={item}>
                        <input
                          type="checkbox"
                          onChange={() => toggleShopping(item)}
                        />
                        <span>{INGREDIENT_EMOJI[item] ?? "🥣"}</span>
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
                    <strong>完全离线</strong>
                    食材、收藏、浏览记录和购物清单均使用浏览器本地存储。
                  </p>
                </div>
                <button
                  className="danger-button"
                  onClick={() => {
                    localStorage.removeItem("smartrecipe-pantry");
                    localStorage.removeItem("smartrecipe-favorites");
                    localStorage.removeItem("smartrecipe-recent");
                    localStorage.removeItem("smartrecipe-shopping");
                    localStorage.removeItem("smartrecipe-compact");
                    setSelectedIngredients(DEFAULT_INGREDIENTS);
                    setFavorites([]);
                    setRecent([]);
                    setShopping([]);
                    setCompactCards(false);
                    announce("本地数据已重置");
                  }}
                >
                  重置全部本地数据
                </button>
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
