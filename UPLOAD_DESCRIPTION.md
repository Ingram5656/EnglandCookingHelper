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
- 所有用户数据通过 `localStorage` 保存在当前设备
- 不调用第三方 API，应用运行期间无需网络

### 验证

- TypeScript 类型检查通过
- Vite 生产构建通过

## 2026-07-25 · 离线打开空白修复

- 将 Vite 构建基准路径改为相对路径，支持直接打开 `dist/index.html`。
- 将本地菜谱图片路径改为跟随应用基准路径，兼容开发模式和构建后离线打开。
- 新增构建后内联步骤，将生产版 JS/CSS 写入 `dist/index.html`，避免 `file://` 下浏览器拦截外部模块资源。
- 修复后重新执行生产构建验证。

## 2026-07-25 · HowToCook 全量菜谱导入

- 从 `D:\Cookingmaster\HowToCook-master\dishes` 导入 368 道真实菜谱，跳过模板目录 `template/示例菜`。
- 新增 `scripts/import-howtocook.mjs`，可重复生成 `app/generated-recipes.json`。
- 将可识别的菜谱图片复制到 `public/howtocook`；无图菜谱使用本地兜底图，仍可离线运行。
- 前端改为读取生成菜谱数据，并自动生成食材 emoji 表与食材建议列表。
- 重新执行生产构建，并用 Chrome 直接打开 `dist/index.html` 验证页面、图片和控制台状态。
