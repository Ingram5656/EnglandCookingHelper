import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir =
  process.env.HOWTOCOOK_DISHES_DIR ??
  path.resolve(rootDir, "..", "HowToCook-master", "dishes");
const outputPath = path.join(rootDir, "app", "generated-recipes.json");
const publicImageDir = path.join(rootDir, "public", "howtocook");

const categoryMap = {
  aquatic: "水产",
  breakfast: "早餐",
  condiment: "调味料",
  dessert: "甜品",
  drink: "饮品",
  meat_dish: "肉菜",
  "semi-finished": "半成品",
  soup: "汤羹",
  staple: "主食",
  vegetable_dish: "家常菜",
};

const emojiRules = [
  [/鸡蛋|蛋/, "🥚"],
  [/番茄|西红柿/, "🍅"],
  [/土豆|马铃薯|洋芋/, "🥔"],
  [/青椒|辣椒|椒/, "🫑"],
  [/葱|香葱/, "🌿"],
  [/蒜/, "🧄"],
  [/姜/, "🫚"],
  [/猪|肉|排骨|牛|羊|鸡|鸭|火腿|培根/, "🥩"],
  [/鱼|虾|蟹|贝|鲈|鲤|鳕|鱿/, "🐟"],
  [/面|粉|馄饨|饺|饭|米|粥|饼|馒头|包子/, "🍚"],
  [/豆腐|豆/, "◻️"],
  [/菜|菠菜|生菜|白菜|油麦|芹菜|西兰花|包菜/, "🥬"],
  [/黄瓜|西葫芦|丝瓜/, "🥒"],
  [/玉米/, "🌽"],
  [/糖|蜂蜜/, "🧂"],
  [/盐/, "🧂"],
  [/油/, "🫗"],
  [/醋|酒|酱油|生抽|老抽|料酒/, "🍶"],
];

const seasoningPattern =
  /盐|糖|油|醋|酱|生抽|老抽|蚝油|料酒|鸡精|味精|胡椒|花椒|八角|桂皮|香叶|淀粉|孜然|辣椒粉|香油|耗油/;
const toolPattern =
  /锅|碗|盘|盆|刀|砧板|筷|勺|铲|烤箱|微波炉|空气炸锅|电饭煲|料理机|容器|保鲜膜|厨房纸|锡纸|牙签|模具|杯|炉|搅拌|冰箱|盅|布|工具|必备/;
const blockedIngredientPattern =
  /^(必备|材料|菜类|菜类材料|工具|冰|布|水|开水|热水|冷水|沸水)$/;
const imagePattern = /\.(jpe?g|png|webp|gif)$/i;

const ingredientAliases = [
  [/^鸡蛋液$/, "鸡蛋"],
  [/^西红柿$/, "番茄"],
  [/^小葱|香葱$/, "葱"],
  [/^蒜$|^蒜瓣$/, "大蒜"],
  [/^马铃薯|洋芋$/, "土豆"],
  [/^青瓜$/, "黄瓜"],
  [/^白砂糖$|^白糖$|^细砂糖$/, "糖"],
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function slugify(input) {
  const ascii = input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const hash = crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
  return ascii ? `${ascii}-${hash}` : `recipe-${hash}`;
}

function cleanInline(value) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]*]\([^)]+\)/g, "")
    .replace(/`/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripRecipeSuffix(title) {
  return title
    .replace(/^#\s*/, "")
    .replace(/的做法$/, "")
    .replace(/做法$/, "")
    .trim();
}

function section(content, headingPattern) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+/.test(line) && headingPattern.test(line));
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n");
}

function extractSummary(content) {
  const lines = content.split(/\r?\n/);
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  const nextHeading = lines.findIndex((line, index) => index > titleIndex && /^##\s+/.test(line));
  const intro = lines
    .slice(titleIndex + 1, nextHeading < 0 ? lines.length : nextHeading)
    .map(cleanInline)
    .filter(Boolean)
    .filter((line) => !/^预计/.test(line))
    .join(" ");
  return intro.slice(0, 110) || "整理自本地 HowToCook 菜谱，支持离线查看和食材匹配。";
}

function extractTime(content, categoryKey) {
  const match = content.match(/(\d+)\s*(?:-|~|到)?\s*(\d+)?\s*分钟/);
  if (match) return Number(match[2] ?? match[1]);
  const defaults = {
    breakfast: 15,
    condiment: 20,
    dessert: 35,
    drink: 10,
    meat_dish: 40,
    aquatic: 30,
    soup: 35,
    staple: 25,
    vegetable_dish: 20,
    "semi-finished": 15,
  };
  return defaults[categoryKey] ?? 25;
}

function extractDifficulty(content, time) {
  const difficultyLine = content
    .split(/\r?\n/)
    .find((line) => /难度|難度/.test(line));
  const stars = difficultyLine?.match(/[★⭐]/g)?.length ?? 0;
  if (stars >= 4) return "进阶";
  if (stars === 3 || time > 35) return "适中";
  return "简单";
}

function extractServings(content) {
  const match = content.match(/(\d+)\s*(?:个)?人|(\d+)\s*份/);
  return Math.max(1, Math.min(8, Number(match?.[1] ?? match?.[2] ?? 2)));
}

function emojiFor(name) {
  return emojiRules.find(([pattern]) => pattern.test(name))?.[1] ?? "🥣";
}

function canonicalIngredientName(name) {
  let normalized = name
    .replace(/\s+/g, "")
    .replace(/or/g, "或")
    .replace(/／/g, "/")
    .trim();
  for (const [pattern, replacement] of ingredientAliases) {
    if (pattern.test(normalized)) return replacement;
  }
  return normalized;
}

function categoryForIngredient(name, type) {
  if (seasoningPattern.test(name) || type === "seasoning") return "调料";
  if (/虾|鱼|蟹|贝|蛏|蛤|蚝|鲍|鱿|章鱼|海参|海带|紫菜|鳗|鳕|鲈|鲤|鲫|鳊|黄鱼|罗氏/.test(name))
    return "海鲜";
  if (/猪|牛|羊|鸡|鸭|鹅|蛋|肉|排骨|里脊|五花|火腿|培根|香肠|腊肠|鸡翅|鸡腿|鸭血|午餐肉/.test(name))
    return "肉类";
  if (/米|饭|面|粉|粉丝|粉条|馒头|包子|饺|馄饨|饼|粥|燕麦|荞麦|意面|通心粉|年糕|吐司|面包|淀粉|薯条/.test(name))
    return "主食";
  if (/菜|萝卜|白菜|生菜|菠菜|芹菜|青椒|辣椒|番茄|西红柿|土豆|茄子|黄瓜|西葫芦|洋葱|葱|姜|蒜|蘑菇|香菇|豆腐|豆芽|玉米|莲藕|冬瓜|南瓜|莴笋|韭菜|西兰花|花菜|包菜|娃娃菜|油麦|香菜|薄荷|果|梨|橙|柠檬|苹果|香蕉|草莓|百香果/.test(name))
    return "蔬菜";
  return "调料";
}

function normalizeIngredientName(rawLine) {
  let line = cleanInline(rawLine)
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+[.、)]\s*/, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/^总量[:：]?\s*/, "")
    .replace(/（.*?）|\(.*?\)/g, "")
    .trim();
  if (!line || /^每次|如下|总量|份数|步骤|可选|注意|注[:：]/.test(line)) return "";
  line = line
    .replace(/^[：:，,。；;、\s-]+/, "")
    .replace(
      /^\d+(\.\d+)?\s*(g|kg|克|千克|ml|mL|毫升|L|升|个|颗|根|片|勺|大勺|小勺|茶匙|汤匙|把|碗|杯|只|条|块|瓣|朵|张|包|盒|罐|袋|斤|两|人份|人|顿)\s*/i,
      "",
    )
    .trim();
  const beforeEqual = line.split(/[=＝:：]/)[0].trim();
  line = beforeEqual || line;
  line = line
    .replace(/\d+(\.\d+)?\s*(g|kg|克|千克|ml|mL|毫升|L|升|个|颗|根|片|勺|大勺|小勺|茶匙|汤匙|把|碗|杯|只|条|块|瓣|朵|张|包|盒|罐|袋|斤|两).*/i, "")
    .replace(/适量|少许|若干|一[个根把碗杯只条块瓣包盒]|半[个根把碗杯]/g, "")
    .replace(/[，,。；;、].*$/, "")
    .replace(/[一二三四五六七八九十两]+(个|颗|根|片|勺|把|碗|杯|只|条|块|瓣|朵|张|包|盒|罐|袋)$/, "")
    .replace(/^[：:，,。；;、\s-]+/, "")
    .trim();
  line = canonicalIngredientName(line);
  if (
    !line ||
    /[?�]/.test(line) ||
    /^[=+\-*]+$/.test(line) ||
    blockedIngredientPattern.test(line) ||
    line.length > 14 ||
    /\d|°|大卡|千卡|分钟|小时|人份|茶匙|汤匙|沸水/.test(line) ||
    toolPattern.test(line)
  )
    return "";
  return line;
}

function extractIngredients(content) {
  const raw = `${section(content, /必备原料|原料|材料|工具/)}\n${section(content, /计算/)}`;
  const seen = new Set();
  const ingredients = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!/^\s*[-*+]\s+|=|＝/.test(line)) continue;
    const name = normalizeIngredientName(line);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const type = seasoningPattern.test(name) ? "seasoning" : "main";
    ingredients.push({
      name,
      amount: "适量",
      type,
      emoji: emojiFor(name),
      category: categoryForIngredient(name, type),
    });
    if (ingredients.length >= 14) break;
  }
  if (ingredients.length) return ingredients;
  return [{ name: "食材", amount: "适量", type: "main", emoji: "🥣" }];
}

function extractSteps(content) {
  const raw = section(content, /操作|步骤|制作/);
  const numbered = raw
    .split(/\r?\n/)
    .filter((line) => /^\s*\d+[.、)]\s+/.test(line))
    .map((line) => cleanInline(line.replace(/^\s*\d+[.、)]\s+/, "")))
    .filter(Boolean);
  if (numbered.length) return numbered.slice(0, 12);
  const paragraphs = raw
    .split(/\r?\n/)
    .map(cleanInline)
    .filter(Boolean)
    .filter((line) => !/^#+/.test(line));
  return paragraphs.slice(0, 8).length
    ? paragraphs.slice(0, 8)
    : ["按原始菜谱准备食材并完成烹饪。"];
}

function firstImageForRecipe(mdPath, content, id) {
  const dir = path.dirname(mdPath);
  const referenced = [...content.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)]
    .map((match) => decodeURI(match[1].split("#")[0]))
    .filter((ref) => imagePattern.test(ref))
    .map((ref) => path.resolve(dir, ref));
  const nearby = fs
    .readdirSync(dir)
    .filter((name) => imagePattern.test(name))
    .map((name) => path.join(dir, name));
  const sourceImage = [...referenced, ...nearby].find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!sourceImage) return null;
  fs.mkdirSync(publicImageDir, { recursive: true });
  const ext = path.extname(sourceImage).toLowerCase();
  const outputName = `${id}${ext}`;
  fs.copyFileSync(sourceImage, path.join(publicImageDir, outputName));
  return `howtocook/${outputName}`;
}

function importRecipes() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`HowToCook dishes directory not found: ${sourceDir}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(publicImageDir, { recursive: true });
  const mdFiles = walk(sourceDir)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => !path.relative(sourceDir, file).startsWith(`template${path.sep}`))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  const recipes = mdFiles.map((file) => {
    const content = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(sourceDir, file).replaceAll(path.sep, "/");
    const categoryKey = relativePath.split("/")[0];
    const title = stripRecipeSuffix(
      content.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(file, ".md"),
    );
    const id = slugify(relativePath);
    const time = extractTime(content, categoryKey);
    const image = firstImageForRecipe(file, content, id) ?? "";
    return {
      id,
      name: title,
      summary: extractSummary(content),
      image,
      category: categoryMap[categoryKey] ?? categoryKey,
      difficulty: extractDifficulty(content, time),
      time,
      servings: extractServings(content),
      ingredients: extractIngredients(content),
      steps: extractSteps(content),
      tip: `来源：HowToCook / ${relativePath}`,
    };
  });

  fs.writeFileSync(outputPath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");
  console.log(`Imported ${recipes.length} recipes from ${sourceDir}`);
}

importRecipes();
