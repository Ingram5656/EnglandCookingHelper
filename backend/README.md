# RecipeNLG Backend

本目录提供 EnglandCookingHelper 的可选本机 AI 菜谱生成服务。前端仍可完全离线使用本地 HowToCook + IndexedDB 数据；只有点击 `AI Generate Recipe` 或本地无匹配时，才会调用该 FastAPI 服务。

## 安装

建议使用独立 Python 虚拟环境。

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

首次运行会从 HuggingFace 下载 `mbien/recipenlg` 模型，需要网络和较大的本地缓存空间。

## 启动

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

健康检查：

```bash
curl http://127.0.0.1:8000/health
```

生成菜谱：

```bash
curl -X POST http://127.0.0.1:8000/generate-recipe ^
  -H "Content-Type: application/json" ^
  -d "{\"ingredients\":[\"chicken\",\"potato\",\"onion\"]}"
```

## API

### `POST /generate-recipe`

请求：

```json
{
  "ingredients": ["chicken", "potato", "onion"],
  "max_new_tokens": 220
}
```

返回：

```json
{
  "recipe": {
    "title": "Chicken Potato Onion Skillet",
    "ingredients": [],
    "steps": [],
    "time": "30 minutes",
    "difficulty": "medium",
    "source": "AI Generated"
  }
}
```

如果模型暂时不可用，服务会返回结构化 fallback 菜谱，避免前端收到空结果。
