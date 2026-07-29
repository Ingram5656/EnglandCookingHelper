# Upload Description

## 2026-07-25 · SmartRecipe 离线前端首版

本次上传根据 `docs/SmartRecipe_Project_Design.md` 和界面参考图完成可运行前端。

### 主要内容

- 建立 React + Vite 离线应用结构
- 完成参考图风格的桌面菜谱推荐界面与移动端适配
- 内置 6 道本地菜谱及配套本地图片
- 实现主料权重 3、调料权重 1 的食材匹配算法
- 支持食材搜索、添加、移除和常见同义词归一化
- 支持匹配度、时间、难度、分类与关键词筛选
- 支持收藏、最近浏览、购物清单和紧凑显示偏好
- 所有用户数据通过 `localStorage` 保存到当前设备
- 不调用第三方 API，应用运行期间无需网络

### 验证

- TypeScript 类型检查通过
- Vite 生产构建通过

## 2026-07-25 · 离线打开空白修复

- 将 Vite 构建基准路径改为相对路径，支持直接打开 `dist/index.html`
- 将本地菜谱图片路径改为跟随应用基准路径，兼容开发模式和构建后离线打开
- 新增构建后内联步骤，将生产版 JS/CSS 写入 `dist/index.html`，避免 `file://` 下浏览器拦截外部模块资源
- 修复后重新执行生产构建验证

## 2026-07-25 · HowToCook 全量菜谱导入

- 从 `D:\Cookingmaster\HowToCook-master\dishes` 导入 368 道真实菜谱，跳过模板目录 `template/示例菜`
- 新增 `scripts/import-howtocook.mjs`，可重复生成 `app/generated-recipes.json`
- 将可识别的菜谱图片复制到 `public/howtocook`；无图菜谱显示“待上传图片”，仍可离线运行
- 前端改为读取生成菜谱数据，并自动生成食材 emoji 表与食材建议列表
- 重新执行生产构建，并用 Chrome 直接打开 `dist/index.html` 验证页面、图片和控制台状态

## 2026-07-25 · 本地数据库、食材清单和菜谱上传

- 新增 IndexedDB 本地数据库，包含 `recipes`、`ingredients`、`meta` 三个对象仓库
- 初次打开时自动把 368 道种子菜谱和食材写入本地数据库
- 修正无图菜谱策略：无原始图片时显示“待上传图片”，不再用其他菜品图片兜底，保证图片严格对应菜谱
- 新增“食材清单”页面，展示当前网站支持的食材、emoji 和主料/调料类型
- 新增“上传菜谱”页面，支持上传菜谱图片、按公式模板导入菜名、分类、难度、时间、食材和步骤
- 新增新食材确认弹窗：导入菜谱时如果食材不在食材数据库中，需要确认后才会添加食材并导入菜谱
- 支持在菜谱详情中为无图菜谱上传图片或替换已有图片，图片数据写入本地数据库
- 重新执行 `pnpm import:howtocook`、`pnpm build`，验证离线页面和食材清单

## 2026-07-25 · 食材清单分类与清洗

- 给“食材清单”页面新增分类筛选：全部、主食、蔬菜、肉类、海鲜、调料
- 每个分类按钮显示当前分类下的食材数量
- 每个食材卡片展示 emoji、名称、分类和主料/调料类型
- 导入脚本新增食材分类逻辑，所有种子食材写入数据库时带有分类字段
- 清理重复食材：归一化“西红柿/番茄”“小葱/香葱/葱”“白糖/白砂糖/糖”等常见别名
- 过滤锅、碗、盘、盆、刀、搅拌机、料理机、烤箱、微波炉、筷、勺、铲、锡纸、保鲜膜、牙签、模具、杯、炉、冰箱等工具或容器类非食材项
- IndexedDB 升级到新版结构，新增 `ingredients.category` 索引；种子版本变化时会重建内置食材清单，同时保留用户自行添加的食材
- 当前种子数据复核结果：368 道菜谱、991 个唯一食材；主食 132、蔬菜 177、肉类 135、海鲜 44、调料 503；工具类关键词检测结果为 0
- 重新执行 `pnpm import:howtocook` 和 `pnpm build` 验证通过

## 2026-07-26 · 食材数据库 Excel 导出

- 新增 `docs/SmartRecipe_Ingredient_Database.xlsx`，导出当前前端种子食材数据库
- Excel 包含 `食材清单` 和 `分类统计` 两张工作表
- `食材清单` 字段包含：序号、食材名称、Emoji、分类、类型、来源、使用菜谱数、示例菜谱
- `分类统计` 汇总菜谱数量、唯一食材数量、工具类关键词检测结果、五类食材数量和主料/调料数量
- 导出数据对应前端初始化写入 IndexedDB `smartrecipe-local-db.ingredients` 的 seed 数据
- 当前导出复核结果：368 道菜谱、991 个唯一食材；工具类关键词检测结果为 0

## 2026-07-26 · 食材数据库 Excel 清洗优化

- 优化 `docs/SmartRecipe_Ingredient_Database.xlsx`，先只修改 Excel 文档，不同步前端代码数据库
- 清理重复和派生名称：例如 `薄荷叶或坚果碎`、`薄荷叶或其他绿叶` 归并为 `薄荷叶`，`菠菜叶` 归并为 `菠菜`
- 清理姜类切法名称：`姜末`、`姜沫`、`姜片`、`姜丝`、`生姜末`、`生姜片` 归并为 `姜`
- 修复 `XX的数量`、`XX的用量为`、`XX大约` 等格式化错误
- 删除工具和非食材说明项：厨房秤、温度计、打火机、过滤网、烤网、量酒器、铝箔纸，以及“根据口味选择加”“核心公式”等说明句
- 细化食材 emoji，从 58 类扩展到 73 类，补充豆类、酒类、香料、饮料、甜品、酱料等更具体的 emoji
- 新增 `清洗记录` 工作表，展示部分名称归并示例
- 当前 Excel 复核结果：863 个唯一食材；主食 115、蔬菜 172、肉类 123、海鲜 44、调料 409；重复名称 0；问题关键词残留 0

## 2026-07-26 · 食材数据库 Excel 人工核查

- 按人工核查清单再次优化 `docs/SmartRecipe_Ingredient_Database.xlsx`，不使用自动规则批量判断
- 删除非食材、工具、说明句和组合项，例如电饼铛、擀面杖、面包机、过滤袋、烘焙纸、密封袋、压汁器、`作为小食`、`作为主食`、`葱+姜+蒜+料酒`、`生抽+老抽+蚝油`
- 合并重复或近义食材，例如 `芝麻香油`、`香油`、`麻油` 归并为 `芝麻油`，`耗油` 归并为 `蚝油`，`白糖`/`白砂糖` 归并为 `糖`，`食盐`/`食用盐`/`盐巴`/`精盐` 归并为 `盐`
- 修正明显带说明文字的食材名称，例如 `蛋挞皮品牌不限整包蛋挞皮约为` 归并为 `蛋挞皮`，`未过期的一袋速冻水饺` 归并为 `速冻水饺`
- `清洗记录` 工作表改为完整人工决策表，记录全部删除和合并/改名决策
- 当前 Excel 复核结果：704 个唯一食材；主食 89、蔬菜 142、肉类 110、海鲜 43、调料 320；重复名称 0；工具/说明/组合类残留扫描 0

## 2026-07-26 · Excel 食材库同步到前端数据库和菜谱

- 新增 `app/ingredient-database.json`，作为由 Excel 同步得到的前端种子食材库
- IndexedDB `ingredients` 初始化改为直接写入该食材库，共 704 个食材
- 同步清洗 `app/generated-recipes.json`；所有菜谱食材均归一到 Excel 食材名，移除工具、说明语句和组合项
- 新增 `scripts/sync-recipes-from-ingredient-database.mjs`，用于在食材库变更后重新清洗菜谱
- `pnpm import:howtocook` 现在会导入 HowToCook 后自动执行食材库同步
- 验证结果：368 道菜谱、704 个数据库食材、实际使用 697 个、暂未使用 7 个、缺失食材 0、空食材菜谱 0、重复菜谱食材 0、工具/说明/组合类残留 0
- 重新执行 `pnpm import:howtocook`、`pnpm sync:ingredient-db` 和 `pnpm build`，验证通过

## 2026-07-29 · RecipeNLG AI 菜谱生成集成

- 新增 `backend/` FastAPI 后端，包含 `app.py`、`recipe_generator.py`、`requirements.txt` 和运行说明
- 后端新增 `POST /generate-recipe`，请求 `{ "ingredients": [...] }`，返回 `{ "recipe": ... }`
- `recipe_generator.py` 封装 HuggingFace `mbien/recipenlg`，支持多食材输入、生成长度控制和非空 fallback 菜谱
- 前端新增 `app/aiRecipe.ts`，通过 `VITE_RECIPE_API_URL` 或默认 `http://127.0.0.1:8000` 调用本机 RecipeNLG API
- 推荐页新增 `AI Generate Recipe` 按钮；当前食材本地匹配度为 0 时，点击推荐会自动尝试调用 RecipeNLG
- 菜谱列表和详情新增模式展示：`Existing Recipe`、`User Recipe`、`AI Creation`
- AI 生成菜谱复用现有 Recipe Viewer、食材清单、步骤和缺少食材展示逻辑，不破坏 IndexedDB 和 HowToCook 导入流程
- 验证：`pnpm build` 通过，`python -m py_compile backend\app.py backend\recipe_generator.py` 通过，`chicken/potato/onion` 生成格式化轻量测试通过

## 2026-07-29 · RecipeNLG 固定 fallback 步骤修复

- 修复 RecipeNLG 原始输出解析逻辑：模型返回的是 `<NEXT_INSTR>`、`<INGR_END>`、`<TITLE_START>` 等标记格式，旧解析器只识别普通文本，导致一直进入 fallback
- 后端 prompt 改为 RecipeNLG 原生格式：`<RECIPE_START><INPUT_START>...<INPUT_END><INGR_START>`
- 新增 RecipeNLG 标记解析，提取真实标题、食材、步骤，只截取第一道生成菜谱，避免串入后续训练样本
- fallback 步骤也改为按输入食材动态生成，不再所有输入都显示同一组步骤
- 验证：真实模型下 `chicken/potato/onion` 返回 `Chicken And Potatoes`，`egg/tomato/rice` 返回 `Tomato Rice Pancakes`，两者步骤不同且没有 `fallback_reason`

## 2026-07-29 · 推荐页滚动和匹配度过滤修复

- 菜谱选择列表和右侧详细菜谱在桌面布局下改为独立滚动，避免浏览长列表时详情区域跟着页面一起移动
- 移动端仍保留单列自然滚动，避免小屏出现过小的嵌套滚动区域
- 推荐菜谱页只显示匹配度 60% 以上的菜谱，低匹配结果不再出现在推荐列表和右侧详情中
- 推荐结果数量文案增加“仅显示匹配度 60%+”提示

## 2026-07-29 · Windows 一键启动脚本

- 新增 `StartSmartRecipe.bat`，用户可在项目根目录双击启动完整环境
- 新增 `scripts/start-smartrecipe.ps1`，负责检查/创建 `backend\.venv`、安装缺失依赖、启动 FastAPI 后端、启动 Vite 前端并打开浏览器
- 启动脚本会设置 `VITE_RECIPE_API_URL=http://127.0.0.1:8000`，确保前端 AI 生成功能连接本机后端
- 如果 8000 或 5173 端口服务已经运行，脚本会复用现有服务并打开前端页面
- 文档新增“一键启动”说明

## 2026-07-29 · 一键启动脚本 pnpm 兜底修复

- 修复普通双击 PowerShell 环境找不到 `pnpm` 时直接退出的问题
- 启动脚本现在会按顺序查找系统 `pnpm`、Codex 内置 Node/pnpm 运行时、系统 `npm`
- 使用 Codex 内置 pnpm 时会自动把内置 Node 目录写入前端服务窗口的 `PATH`
- 验证：`scripts/start-smartrecipe.ps1 -DryRun` 通过
