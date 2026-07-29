# SmartRecipe

一个按本地食材推荐菜谱的离线前端原型。界面参考桌面端菜谱助手，所有菜谱、图片和交互数据均在本地运行，不调用在线 API。

## 已实现

- 食材添加、删除、清空与常见同义词归一化
- 主料权重 3、调料权重 1 的本地匹配算法
- 按匹配度、时间、难度和分类筛选
- 菜谱详情、缺少食材提示和制作步骤
- 收藏、最近浏览、购物清单与显示偏好
- 使用 IndexedDB 持久化本地菜谱、食材、上传图片和导入数据
- “食材清单”页面展示网站支持的食材、emoji、类型和分类
- 食材清单支持分类筛选：主食、蔬菜、肉类、海鲜、调料
- “上传菜谱”页面支持菜谱图片上传和公式化模板导入
- 可选 FastAPI + RecipeNLG 后端，支持无本地匹配时生成 AI 菜谱
- 菜谱模式区分 `Existing Recipe`、`User Recipe` 和 `AI Creation`
- 桌面与移动端响应式界面

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
pnpm install
pnpm dev
```

浏览终端显示的本地地址即可。首次安装依赖需要网络，之后应用运行期间无需互联网。

生产构建：

```bash
pnpm build
```

构建后可直接离线打开：

```text
dist/index.html
```

## Windows 一键启动

双击项目根目录的 `StartSmartRecipe.bat` 可以自动启动完整开发环境：

- 检查或创建 `backend\.venv`
- 检查并安装后端依赖
- 检查并安装前端依赖
- 优先使用系统 `pnpm`，找不到时自动尝试 Codex 内置 Node/pnpm 运行时
- 启动 RecipeNLG FastAPI 后端：`http://127.0.0.1:8000`
- 启动 Vite 前端：`http://127.0.0.1:5173`
- 自动打开浏览器

启动后会出现两个服务窗口：一个后端窗口、一个前端窗口。窗口需要保持打开；关闭窗口即停止对应服务。

## RecipeNLG AI 生成后端

前端默认仍然可以完全离线使用本地 HowToCook 菜谱和 IndexedDB。RecipeNLG 是可选本机后端：只有点击 `AI Generate Recipe`，或当前食材没有本地匹配时，前端才会尝试调用 `http://127.0.0.1:8000/generate-recipe`。

启动后端：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

首次运行会从 HuggingFace 下载 `mbien/recipenlg` 模型，需要网络和本地缓存空间。后端如果无法加载模型，会返回结构化 fallback 菜谱，避免前端收到空结果。

如需修改前端调用地址：

```powershell
$env:VITE_RECIPE_API_URL="http://127.0.0.1:8000"
pnpm dev
```

## 数据与素材

菜谱结构和本地图片整理自 [HowToCook](https://github.com/Anduin2017/HowToCook)，并为当前离线推荐演示做了结构化处理。原项目采用 Unlicense。

食材数据库来源于 `docs/SmartRecipe_Ingredient_Database.xlsx` 的人工核查结果，并同步生成到 `app/ingredient-database.json`。前端首次打开时会把这份 JSON 作为 `ingredients` 表的种子数据写入浏览器 IndexedDB。

## 导入 HowToCook 菜谱

当前版本已从 `D:\Cookingmaster\HowToCook-master\dishes` 导入 368 道本地菜谱，跳过 `template/示例菜`。导入结果保存到 `app/generated-recipes.json`，可在离线前端中直接搜索、筛选和匹配。

如需重新导入本地 HowToCook 菜谱：

```bash
pnpm import:howtocook
pnpm build
```

导入脚本会：

- 复制可识别的菜谱图片到 `public/howtocook`
- 为无图菜谱显示“待上传图片”
- 生成 `app/generated-recipes.json`
- 自动执行 `scripts/sync-recipes-from-ingredient-database.mjs`，把菜谱食材同步清洗为 Excel 食材库中的规范名称
- 过滤锅、碗、刀、搅拌机、烤箱等工具或容器类非食材项

如果只修改了 `app/ingredient-database.json`，可单独同步清洗菜谱：

```bash
pnpm sync:ingredient-db
pnpm build
```

## 本地数据库功能

应用首次打开时会把内置菜谱和 Excel 同步后的食材库写入浏览器 IndexedDB。运行后新增或修改的数据也会写入本地数据库：

- `recipes`：菜谱、步骤、分类、食材、图片引用或上传图片数据
- `ingredients`：网站支持的食材名称、类型、emoji 和分类
- `meta`：本地种子数据版本

当前种子数据包含：

- 368 道菜谱
- 704 个 Excel 人工核查后的唯一食材
- 主食 89 个、蔬菜 142 个、肉类 110 个、海鲜 43 个、调料 320 个
- 菜谱中实际使用 697 个食材，暂未使用 7 个食材

当前同步校验结果：

- 菜谱食材全部存在于 `app/ingredient-database.json`
- 空食材菜谱：0
- 菜谱内重复食材：0
- 工具、说明语句、组合项残留扫描：0

数据库升级或种子版本变化时，会重建内置食材清单，同时保留用户自行新增的食材。

无原始图片的菜谱会显示“待上传图片”，不会使用其他菜谱图片冒充。可以在菜谱详情中上传或替换图片，也可以在“上传菜谱”页面按模板导入新菜谱。如果模板里包含食材库不存在的食材，应用会先弹窗确认是否添加该食材。
