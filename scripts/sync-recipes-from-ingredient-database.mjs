import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipesPath = path.join(rootDir, "app", "generated-recipes.json");
const ingredientsPath = path.join(rootDir, "app", "ingredient-database.json");

const catalog = new Map(
  JSON.parse(fs.readFileSync(ingredientsPath, "utf8")).map((ingredient) => [
    ingredient.name,
    ingredient,
  ]),
);

const aliases = new Map([
  ["西红柿", "番茄"],
  ["小葱", "葱"],
  ["香葱", "葱"],
  ["蒜", "大蒜"],
  ["蒜瓣", "大蒜"],
  ["马铃薯", "土豆"],
  ["洋芋", "土豆"],
  ["青瓜", "黄瓜"],
  ["芝麻香油", "芝麻油"],
  ["香油", "芝麻油"],
  ["麻油", "芝麻油"],
  ["耗油", "蚝油"],
  ["白糖", "糖"],
  ["白砂糖", "糖"],
  ["食盐", "盐"],
  ["食用盐", "盐"],
  ["盐巴", "盐"],
  ["精盐", "盐"],
  ["油", "食用油"],
  ["植物油", "食用油"],
  ["食用植物油", "食用油"],
  ["生姜", "姜"],
  ["老姜", "姜"],
  ["小米辣", "小米椒"],
  ["干小米椒", "小米椒"],
  ["红辣椒", "红椒"],
  ["青辣椒", "青椒"],
  ["红萝卜", "胡萝卜"],
  ["巴斯马蒂长粒香米", "巴斯马蒂香米"],
  ["巴斯马蒂香米或普通大米", "巴斯马蒂香米"],
  ["未过期的一袋速冻馄饨", "速冻馄饨"],
  ["未过期的一袋速冻水饺", "速冻水饺"],
  ["袋装螺蛳粉", "螺蛳粉"],
  ["袋泡红茶", "红茶茶包"],
  ["蛋挞皮品牌不限", "蛋挞皮"],
  ["蛋挞皮品牌不限整包蛋挞皮约为", "蛋挞皮"],
  ["蛋挞液约", "蛋挞液"],
  ["白朗姆", "白朗姆酒"],
  ["金色朗姆酒", "朗姆酒"],
  ["蓝天原味伏特加", "伏特加"],
  ["漓泉啤酒", "啤酒"],
  ["可口可乐", "可乐"],
  ["NFC橙汁", "橙汁"],
  ["espresso意式浓缩", "浓缩咖啡"],
  ["瓶装椰汁", "椰汁"],
  ["瓶装椰子汁", "椰汁"],
  ["椰树牌椰汁", "椰汁"],
  ["郫县豆瓣", "豆瓣酱"],
  ["郫县豆瓣酱", "豆瓣酱"],
  ["郫县红油豆瓣酱", "豆瓣酱"],
  ["红油豆瓣酱", "豆瓣酱"],
  ["豆瓣", "豆瓣酱"],
  ["豆鼓", "豆豉"],
  ["阳江豆豉", "豆豉"],
  ["蕃茄酱", "番茄酱"],
  ["百味来拿坡里意面酱", "意大利面酱"],
  ["柱侯酱", "柱候酱"],
  ["菜油", "菜籽油"],
  ["纯猪油", "猪油"],
  ["黑椒", "黑胡椒"],
  ["黑椒粉", "黑胡椒粉"],
  ["黑椒碎", "黑胡椒碎"],
  ["黑胡椒粒大概", "黑胡椒粒"],
  ["孜然籽", "孜然粒"],
  ["椒盐粉", "椒盐"],
  ["鸡粉", "鸡精"],
  ["肉桂棒", "桂皮"],
  ["肉桂皮", "桂皮"],
  ["干辣椒段", "干辣椒"],
  ["干辣椒碎", "干辣椒"],
  ["干辣椒粉", "辣椒粉"],
  ["红辣椒粉", "辣椒粉"],
  ["细辣椒粉", "辣椒粉"],
  ["干辣椒面", "辣椒面"],
  ["中粗辣椒面", "辣椒面"],
  ["泡好的粉丝", "粉丝"],
  ["糯米粉a", "糯米粉"],
  ["糯米粉b", "糯米粉"],
  ["安琪干酵母粉", "酵母粉"],
  ["的干紫菜", "紫菜"],
  ["菠菜叶", "菠菜"],
  ["薄荷叶或坚果碎", "薄荷叶"],
  ["薄荷叶或其他绿叶", "薄荷叶"],
  ["新鲜薄荷叶", "薄荷叶"],
  ["五珠薄荷叶", "薄荷叶"],
  ["香菜按照个人口味", "香菜"],
  ["香菜碎根据口味加", "香菜"],
  ["花菜约", "花菜"],
  ["西兰花约", "西兰花"],
  ["包菜半颗", "包菜"],
  ["葱半根", "葱"],
  ["葱白", "葱"],
  ["大葱葱白", "大葱"],
  ["大葱小", "大葱"],
  ["大蒜半瓣", "大蒜"],
  ["两瓣大蒜", "大蒜"],
  ["拍碎的蒜瓣", "大蒜"],
  ["蒜半头", "大蒜"],
  ["蒜头", "大蒜"],
  ["蒜仔", "大蒜"],
  ["黄瓜丝", "黄瓜"],
  ["芹菜两根中等大小的芹菜", "芹菜"],
  ["新鲜菜心", "菜心"],
  ["新鲜空心菜", "空心菜"],
  ["洋葱一头", "洋葱"],
  ["长条青椒", "青椒"],
  ["内脂豆腐", "内酯豆腐"],
  ["豆块豆筋豆腐皮等豆制品类", "豆制品"],
  ["冷冻青豆", "青豆"],
  ["闽星茶树菇", "茶树菇"],
]);

const blockedNames = new Set([
  "冰块",
  "冰几块",
  "打碎的冰块",
  "大冰块差不多就行",
  "电饼铛",
  "擀面杖",
  "面包机",
  "手动压汁器",
  "压汁器",
  "榨汁机",
  "过滤网",
  "厨房秤",
  "厨房用夹",
  "厨房用温度计",
  "打火机",
  "捣药罐",
  "定时器",
  "隔热手套",
  "烤网",
  "锡箔纸",
  "铝箔纸",
  "烘焙纸",
  "烘焙油纸",
  "密封袋",
  "一次性手套",
  "一次性塑料手套",
  "调料",
  "调味料",
  "辅料",
  "炒料",
  "风味调料",
  "单人",
  "非黑暗料理",
  "核心公式",
  "建议比例",
  "根据个人经验",
  "葱+姜+蒜+料酒",
  "生抽+老抽+蚝油",
  "盐+鸡精+十三香",
  "葱姜蒜",
  "姜蒜",
  "葱姜",
  "葱姜水",
  "葱姜花椒水",
  "菜码",
  "配菜",
  "蔬菜",
  "叶菜类蔬菜",
  "蔬菜碎叶",
  "面类材料",
  "面食材料",
  "面团",
]);

function resolveName(rawName) {
  if (catalog.has(rawName)) return rawName;
  if (blockedNames.has(rawName)) return null;
  if (aliases.has(rawName)) return aliases.get(rawName);

  let name = rawName
    .trim()
    .replace(/\s+/g, "")
    .replace(/\*/g, "")
    .replace(/（.*?）|\(.*?\)/g, "")
    .replace(/的用量为$|用量为$|的数量$|数量$|大约$|约$|几滴$|按照个人口味$|根据口味加$/g, "")
    .replace(/半根$|半瓣$|一头$|半头$|小$|大$/g, "")
    .trim();
  if (!name || /^如果/.test(name)) return null;
  if (catalog.has(name)) return name;
  if (blockedNames.has(name)) return null;
  if (aliases.has(name)) return aliases.get(name);

  for (const separator of ["或者", "或", "/", "、"]) {
    if (!name.includes(separator)) continue;
    const first = name.split(separator)[0].trim();
    if (catalog.has(first)) return first;
    if (aliases.has(first)) return aliases.get(first);
  }

  const suffixRules = [
    [/^姜[末沫片丝块丁碎蓉]$/, "姜"],
    [/^生姜[末沫片丝块丁碎蓉]?$/, "姜"],
    [/^蒜[末沫片丝块丁碎蓉]$/, "大蒜"],
    [/^大蒜[末沫片丝块丁碎蓉]$/, "大蒜"],
    [/^葱[花段末丝碎结头]?$/, "葱"],
    [/^干辣椒(段|碎)?$/, "干辣椒"],
    [/^.*辣椒粉$/, "辣椒粉"],
    [/^.*辣椒面$/, "辣椒面"],
  ];
  for (const [pattern, target] of suffixRules) {
    if (pattern.test(name) && catalog.has(target)) return target;
  }
  return null;
}

const recipes = JSON.parse(fs.readFileSync(recipesPath, "utf8"));
let renamed = 0;
let removed = 0;

const syncedRecipes = recipes.map((recipe) => {
  const ingredientMap = new Map();
  for (const ingredient of recipe.ingredients ?? []) {
    const targetName = resolveName(ingredient.name);
    if (!targetName || !catalog.has(targetName)) {
      removed += 1;
      continue;
    }
    if (targetName !== ingredient.name) renamed += 1;
    const base = catalog.get(targetName);
    if (!ingredientMap.has(targetName)) {
      ingredientMap.set(targetName, {
        ...base,
        amount: ingredient.amount || "适量",
      });
    }
  }
  return {
    ...recipe,
    ingredients: [...ingredientMap.values()],
  };
});

fs.writeFileSync(recipesPath, `${JSON.stringify(syncedRecipes, null, 2)}\n`, "utf8");
console.log(
  `Synced ${syncedRecipes.length} recipes with ${catalog.size} catalog ingredients; renamed ${renamed}, removed ${removed}.`,
);
