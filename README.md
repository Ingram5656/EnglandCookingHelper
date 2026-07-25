# SmartRecipe

一个按照本地食材推荐菜谱的离线前端原型。界面参考桌面端菜谱助手，所有菜谱、图片和交互数据均在本地运行，不调用在线 API。

## 已实现

- 食材添加、删除、清空与同义词归一化
- 主料权重 3、调料权重 1 的本地匹配算法
- 按匹配度、时间、难度和分类筛选
- 菜谱详情、缺少食材提示和制作步骤
- 收藏、最近浏览、购物清单与显示偏好
- 使用 `localStorage` 持久化本机数据
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

## 数据与素材

菜谱结构和本地图片整理自 [HowToCook](https://github.com/Anduin2017/HowToCook)，并为当前离线推荐演示做了精简和结构化处理。原项目采用 Unlicense。

## 导入 HowToCook 菜谱

当前版本已从 `D:\Cookingmaster\HowToCook-master\dishes` 导入 368 道本地菜谱，跳过 `template/示例菜`。导入结果保存在 `app/generated-recipes.json`，可在离线前端中直接搜索、筛选和匹配。

如需重新导入本地 HowToCook 菜谱：

```bash
pnpm import:howtocook
pnpm build
```

导入脚本会复制可识别的菜谱图片到 `public/howtocook`，没有图片的菜谱会使用本地兜底图。
