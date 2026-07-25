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

const recipeAsset = (fileName: string) =>
  `${import.meta.env.BASE_URL}recipes/${fileName}`;

export const INGREDIENT_EMOJI: Record<string, string> = {
  鸡蛋: "🥚",
  番茄: "🍅",
  西红柿: "🍅",
  青椒: "🫑",
  土豆: "🥔",
  葱: "🌿",
  大蒜: "🧄",
  面条: "🍜",
  猪肉: "🥩",
  西葫芦: "🥒",
  菠菜: "🥬",
  豆腐: "◻️",
  白糖: "🧂",
  食用油: "🫗",
  盐: "🧂",
  醋: "🍶",
};

export const INGREDIENT_SUGGESTIONS = [
  "鸡蛋",
  "番茄",
  "青椒",
  "土豆",
  "葱",
  "大蒜",
  "面条",
  "猪肉",
  "西葫芦",
  "菠菜",
  "豆腐",
  "白糖",
  "食用油",
  "盐",
  "醋",
];

export const SYNONYMS: Record<string, string> = {
  西红柿: "番茄",
  小葱: "葱",
  香葱: "葱",
  蒜: "大蒜",
  蒜瓣: "大蒜",
  马铃薯: "土豆",
  洋芋: "土豆",
};

export const RECIPES: Recipe[] = [
  {
    id: "tomato-egg-noodle",
    name: "西红柿鸡蛋挂面",
    summary: "酸甜汤底包裹筋道面条，十几分钟就能完成的一人食。",
    image: recipeAsset("tomato-noodle.jpg"),
    category: "主食",
    difficulty: "简单",
    time: 15,
    servings: 1,
    ingredients: [
      { name: "鸡蛋", amount: "1 个", type: "main", emoji: "🥚" },
      { name: "番茄", amount: "1 个", type: "main", emoji: "🍅" },
      { name: "面条", amount: "100 克", type: "main", emoji: "🍜" },
      { name: "青椒", amount: "半个", type: "main", emoji: "🫑" },
      { name: "葱", amount: "1 根", type: "seasoning", emoji: "🌿" },
      { name: "盐", amount: "适量", type: "seasoning", emoji: "🧂" },
      { name: "食用油", amount: "适量", type: "seasoning", emoji: "🫗" },
    ],
    steps: [
      "番茄切块，青椒切丝，鸡蛋打散，葱切成葱花。",
      "锅中放少量油，倒入蛋液炒至凝固后盛出。",
      "原锅放入番茄和青椒，炒软后加入一碗清水。",
      "汤煮开后放入挂面，中火煮至面条没有硬芯。",
      "放回炒蛋，加盐调味，撒葱花即可。",
    ],
    tip: "番茄先炒出沙再加水，汤底会更浓郁。",
  },
  {
    id: "pepper-potato",
    name: "青椒土豆丝",
    summary: "脆爽清香的家常快手菜，搭配米饭尤其合适。",
    image: recipeAsset("pepper-potato.jpg"),
    category: "家常菜",
    difficulty: "简单",
    time: 15,
    servings: 2,
    ingredients: [
      { name: "青椒", amount: "1 个", type: "main", emoji: "🫑" },
      { name: "土豆", amount: "2 个", type: "main", emoji: "🥔" },
      { name: "大蒜", amount: "2 瓣", type: "seasoning", emoji: "🧄" },
      { name: "葱", amount: "1 根", type: "seasoning", emoji: "🌿" },
      { name: "盐", amount: "适量", type: "seasoning", emoji: "🧂" },
      { name: "醋", amount: "1 勺", type: "seasoning", emoji: "🍶" },
      { name: "食用油", amount: "适量", type: "seasoning", emoji: "🫗" },
    ],
    steps: [
      "土豆去皮切细丝，用清水冲洗两遍并沥干。",
      "青椒切丝，大蒜切片，葱切段。",
      "热锅凉油，下蒜片和葱段炒香。",
      "倒入土豆丝大火翻炒，再加入青椒丝。",
      "沿锅边淋醋，加盐调味，翻炒均匀即可。",
    ],
    tip: "土豆丝洗去表面淀粉后，炒出来会更脆。",
  },
  {
    id: "zucchini-egg",
    name: "西葫芦炒鸡蛋",
    summary: "鲜嫩清甜，食材简单，适合工作日快速完成。",
    image: recipeAsset("zucchini-egg.jpeg"),
    category: "家常菜",
    difficulty: "简单",
    time: 12,
    servings: 2,
    ingredients: [
      { name: "西葫芦", amount: "1 根", type: "main", emoji: "🥒" },
      { name: "鸡蛋", amount: "2 个", type: "main", emoji: "🥚" },
      { name: "大蒜", amount: "2 瓣", type: "seasoning", emoji: "🧄" },
      { name: "盐", amount: "适量", type: "seasoning", emoji: "🧂" },
      { name: "食用油", amount: "适量", type: "seasoning", emoji: "🫗" },
    ],
    steps: [
      "西葫芦洗净切薄片，鸡蛋加少许盐打散。",
      "热锅放油，倒入蛋液，炒成大块后盛出。",
      "锅中补少许油，放蒜片炒香。",
      "倒入西葫芦快速翻炒至稍微变软。",
      "加入炒蛋和盐，翻匀后立即出锅。",
    ],
    tip: "西葫芦不宜久炒，保持微脆口感更好。",
  },
  {
    id: "caramel-potato",
    name: "拔丝土豆",
    summary: "外脆内软、糖丝晶亮，在家也能做的经典甜菜。",
    image: recipeAsset("caramel-potato.jpeg"),
    category: "特色菜",
    difficulty: "适中",
    time: 30,
    servings: 3,
    ingredients: [
      { name: "土豆", amount: "3 个", type: "main", emoji: "🥔" },
      { name: "白糖", amount: "80 克", type: "seasoning", emoji: "🧂" },
      { name: "食用油", amount: "适量", type: "seasoning", emoji: "🫗" },
    ],
    steps: [
      "土豆去皮切成滚刀块，擦干表面水分。",
      "油温六成热时放入土豆，炸至金黄熟透后捞出。",
      "锅中留少许底油，放白糖小火不停搅拌。",
      "糖液变成琥珀色并冒细泡时关火。",
      "迅速倒入土豆块翻匀，装入抹油的盘中。",
    ],
    tip: "熬糖全程用小火，颜色变深后要立即关火。",
  },
  {
    id: "spinach-egg",
    name: "菠菜炒鸡蛋",
    summary: "颜色清新、口感柔嫩，一盘补充两种日常食材。",
    image: recipeAsset("spinach-egg.jpg"),
    category: "家常菜",
    difficulty: "简单",
    time: 10,
    servings: 2,
    ingredients: [
      { name: "菠菜", amount: "250 克", type: "main", emoji: "🥬" },
      { name: "鸡蛋", amount: "2 个", type: "main", emoji: "🥚" },
      { name: "大蒜", amount: "2 瓣", type: "seasoning", emoji: "🧄" },
      { name: "盐", amount: "适量", type: "seasoning", emoji: "🧂" },
      { name: "食用油", amount: "适量", type: "seasoning", emoji: "🫗" },
    ],
    steps: [
      "菠菜洗净切段，沸水中焯烫 20 秒后挤干。",
      "鸡蛋打散，热锅放油炒至蓬松后盛出。",
      "蒜末下锅炒香，放入菠菜快速翻炒。",
      "倒回鸡蛋，加盐调味，翻匀即可。",
    ],
    tip: "菠菜先短暂焯水，颜色更翠绿，口感也更柔和。",
  },
  {
    id: "tomato-tofu",
    name: "西红柿豆腐汤羹",
    summary: "清爽微酸的暖胃汤羹，豆腐柔嫩、汤汁鲜美。",
    image: recipeAsset("tomato-tofu.jpeg"),
    category: "汤羹",
    difficulty: "简单",
    time: 20,
    servings: 3,
    ingredients: [
      { name: "番茄", amount: "2 个", type: "main", emoji: "🍅" },
      { name: "豆腐", amount: "1 盒", type: "main", emoji: "◻️" },
      { name: "鸡蛋", amount: "1 个", type: "main", emoji: "🥚" },
      { name: "葱", amount: "1 根", type: "seasoning", emoji: "🌿" },
      { name: "盐", amount: "适量", type: "seasoning", emoji: "🧂" },
      { name: "食用油", amount: "少量", type: "seasoning", emoji: "🫗" },
    ],
    steps: [
      "番茄切块，豆腐切小方块，鸡蛋打散。",
      "锅中放少量油，把番茄炒软出汁。",
      "加入两碗热水，煮开后放入豆腐。",
      "小火煮 5 分钟，沿锅边淋入蛋液。",
      "蛋花凝固后加盐调味，撒葱花即可。",
    ],
    tip: "豆腐入锅后减少翻动，避免汤中出现碎渣。",
  },
];
