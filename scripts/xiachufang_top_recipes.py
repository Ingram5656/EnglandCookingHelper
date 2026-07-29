#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
使用本机 Edge / Chrome 浏览器低频读取下厨房公开榜单，输出统一菜谱 JSON。

普通 requests 可能被目标站点返回伪 404，因此本版本使用 Playwright 驱动
本机真实浏览器。脚本不会绕过登录、验证码或其他访问控制。
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup, Tag
from PIL import Image
from playwright.sync_api import (
    BrowserContext,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


BASE_URL = "https://m.xiachufang.com"
DEFAULT_OUTPUT = "xiachufang_top_recipes.json"
DEFAULT_IMAGE_DIR = "howtocook"
DEFAULT_DELAY_MIN = 4.0
DEFAULT_DELAY_MAX = 7.0
DEFAULT_TIMEOUT_SECONDS = 40

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0 Safari/537.36"
)

SEASONING_KEYWORDS = {
    "盐", "糖", "白糖", "冰糖", "红糖", "生抽", "老抽", "酱油", "醋",
    "陈醋", "米醋", "香醋", "料酒", "黄酒", "油", "食用油", "植物油",
    "橄榄油", "花生油", "菜籽油", "香油", "芝麻油", "蚝油", "鸡精",
    "味精", "胡椒", "胡椒粉", "黑胡椒", "白胡椒", "花椒", "八角",
    "桂皮", "香叶", "孜然", "孜然粉", "辣椒粉", "淀粉", "玉米淀粉",
    "豆瓣酱", "甜面酱", "番茄酱", "沙拉酱", "蜂蜜", "酵母", "泡打粉",
    "小苏打", "五香粉", "十三香", "咖喱粉", "咖喱块", "芝麻", "水",
}

CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("调味料", tuple(SEASONING_KEYWORDS)),
    ("蛋奶", ("鸡蛋", "鸭蛋", "鹌鹑蛋", "蛋黄", "蛋白", "牛奶", "酸奶", "奶油", "淡奶油", "芝士", "奶酪", "黄油", "炼乳")),
    ("肉类", ("猪肉", "五花肉", "里脊", "排骨", "肉末", "肉馅", "牛肉", "牛腩", "羊肉", "鸡肉", "鸡胸", "鸡腿", "鸡翅", "鸭肉", "鹅肉", "火腿", "培根", "腊肉", "香肠")),
    ("水产", ("鱼", "虾", "蟹", "贝", "蛤蜊", "生蚝", "鱿鱼", "章鱼", "海参", "鲍鱼", "扇贝")),
    ("豆制品", ("豆腐", "豆干", "腐竹", "豆皮", "千张", "豆浆", "黄豆", "黑豆", "红豆", "绿豆", "豆芽")),
    ("菌菇", ("香菇", "蘑菇", "口蘑", "金针菇", "杏鲍菇", "木耳", "银耳", "平菇", "松茸", "竹荪")),
    ("主食", ("大米", "米饭", "糯米", "面粉", "面条", "挂面", "意面", "粉丝", "米粉", "年糕", "馒头", "面包", "燕麦", "玉米面", "淀粉")),
    ("水果", ("苹果", "香蕉", "橙", "柠檬", "草莓", "蓝莓", "芒果", "葡萄", "梨", "桃", "菠萝", "西瓜", "猕猴桃", "牛油果", "椰子")),
    ("蔬菜", ("番茄", "西红柿", "土豆", "马铃薯", "胡萝卜", "白萝卜", "白菜", "青菜", "菠菜", "生菜", "芹菜", "黄瓜", "冬瓜", "南瓜", "西葫芦", "茄子", "辣椒", "青椒", "洋葱", "大葱", "小葱", "香葱", "姜", "蒜", "香菜", "韭菜", "莲藕", "山药", "玉米", "西兰花", "花菜", "莴笋", "豆角")),
]

EMOJI_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("🥚", ("鸡蛋", "鸭蛋", "鹌鹑蛋", "蛋黄", "蛋白")),
    ("🥩", ("猪肉", "牛肉", "羊肉", "五花肉", "里脊", "排骨", "肉末", "肉馅")),
    ("🍗", ("鸡肉", "鸡胸", "鸡腿", "鸡翅", "鸭肉", "鹅肉")),
    ("🐟", ("鱼", "鳕鱼", "鲈鱼", "鲫鱼", "三文鱼")),
    ("🦐", ("虾", "对虾", "虾仁")),
    ("🦀", ("蟹", "螃蟹")),
    ("🥛", ("牛奶", "酸奶", "奶油", "炼乳")),
    ("🧀", ("芝士", "奶酪", "黄油")),
    ("🍅", ("番茄", "西红柿")),
    ("🥔", ("土豆", "马铃薯")),
    ("🥕", ("胡萝卜",)),
    ("🌽", ("玉米",)),
    ("🥒", ("黄瓜", "西葫芦")),
    ("🍆", ("茄子",)),
    ("🥦", ("西兰花", "花菜")),
    ("🥬", ("白菜", "青菜", "菠菜", "生菜", "芹菜", "莴笋")),
    ("🌶️", ("辣椒", "青椒", "辣椒粉")),
    ("🧅", ("洋葱", "大葱", "小葱", "香葱")),
    ("🧄", ("蒜", "大蒜")),
    ("🍚", ("大米", "米饭", "糯米")),
    ("🍜", ("面条", "挂面", "意面", "米粉", "粉丝")),
    ("🍞", ("面粉", "面包", "馒头")),
    ("🍎", ("苹果",)),
    ("🍌", ("香蕉",)),
    ("🍋", ("柠檬",)),
    ("🍓", ("草莓",)),
    ("🥭", ("芒果",)),
    ("🍄", ("香菇", "蘑菇", "口蘑", "金针菇", "杏鲍菇", "木耳", "银耳", "平菇")),
    ("🫘", ("豆腐", "豆干", "腐竹", "豆皮", "黄豆", "黑豆", "红豆", "绿豆")),
    ("🧂", ("盐", "糖", "酱油", "生抽", "老抽", "醋", "料酒", "蚝油", "胡椒", "花椒", "淀粉")),
    ("💧", ("水", "清水", "开水", "温水")),
]

UNIT_PATTERN = (
    r"克|千克|公斤|斤|两|个|只|颗|枚|勺|大勺|小勺|汤匙|茶匙|"
    r"毫升|升|片|块|根|把|瓣|碗|杯|包|袋|盒|罐|滴|撮|枝|朵|"
    r"节|条|张|份|g|kg|ml|l"
)
AMOUNT_TOKEN = rf"(?:约|大约|适量|少许|若干|按需|一小把|一把|半|[\d一二三四五六七八九十百]+(?:[./～~\-][\d一二三四五六七八九十百]+)?)\s*(?:{UNIT_PATTERN})?(?:左右)?"


class CrawlError(RuntimeError):
    pass


class RateLimited(CrawlError):
    pass


@dataclass
class Ingredient:
    name: str
    amount: str
    type: str
    emoji: str
    category: str


@dataclass
class Recipe:
    id: str
    name: str
    summary: str
    image: str
    category: str
    difficulty: str
    time: int
    servings: int
    ingredients: list[Ingredient] = field(default_factory=list)
    steps: list[str] = field(default_factory=list)
    tip: str = ""


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def trim_text(value: str, max_length: int = 120) -> str:
    value = clean_text(value)
    if len(value) <= max_length:
        return value
    return value[: max_length - 1].rstrip("，。；;,. ") + "…"


def first_text(node: Tag | BeautifulSoup, selectors: Iterable[str]) -> str:
    for selector in selectors:
        element = node.select_one(selector)
        if element:
            text = clean_text(element.get_text(" ", strip=True))
            if text:
                return text
    return ""


def first_attr(
    node: Tag | BeautifulSoup,
    selectors: Iterable[str],
    attributes: Iterable[str],
) -> str:
    for selector in selectors:
        element = node.select_one(selector)
        if not element:
            continue
        for attribute in attributes:
            value = element.get(attribute)
            if value:
                return clean_text(str(value))
    return ""


def parse_int(value: Any) -> int | None:
    if value is None:
        return None
    match = re.search(r"[\d,]+", str(value))
    return int(match.group(0).replace(",", "")) if match else None


def normalize_image(value: Any) -> str:
    if isinstance(value, list):
        value = value[0] if value else ""
    if isinstance(value, dict):
        value = value.get("url") or value.get("contentUrl") or ""
    if not isinstance(value, str):
        return ""
    if value.startswith("//"):
        return "https:" + value
    return urljoin(BASE_URL, value)


def polite_sleep(delay_min: float, delay_max: float) -> None:
    time.sleep(random.uniform(delay_min, delay_max))


def browser_fetch_html(page: Page, url: str, timeout_ms: int) -> str:
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    except PlaywrightTimeoutError as exc:
        raise CrawlError(f"浏览器访问超时：{url}") from exc

    if response is None:
        raise CrawlError(f"浏览器没有收到HTTP响应：{url}")

    status = response.status
    page.wait_for_timeout(800)

    if status == 429:
        raise RateLimited("服务器返回429，脚本已停止。请稍后运行并增大请求间隔。")
    if status in (401, 403):
        raise CrawlError(
            f"访问被拒绝，HTTP {status}：{url}\n"
            "请停止运行，不要尝试绕过登录、验证码或访问控制。"
        )
    if status >= 400:
        raise CrawlError(f"浏览器收到 HTTP {status}：{url}")

    title = clean_text(page.title())
    visible_text = clean_text(page.locator("body").inner_text(timeout=5000))
    suspicious = ("安全验证", "访问异常", "验证码", "请求过于频繁")
    if any(keyword in title or keyword in visible_text[:500] for keyword in suspicious):
        raise CrawlError(
            "页面要求安全验证。请停止脚本，在普通浏览器中确认网站可正常访问后再运行。"
        )

    return page.content()


def add_page_number(url: str, page_number: int) -> str:
    if page_number == 1:
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["page"] = str(page_number)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def discover_category_sort_url(
    page: Page,
    mode: str,
    category_id: str,
    timeout_ms: int,
) -> str:
    base_url = f"{BASE_URL}/category/{category_id}/"
    html = browser_fetch_html(page, base_url, timeout_ms)
    soup = BeautifulSoup(html, "lxml")
    target_text = "最受欢迎" if mode == "category-popular" else "评分"

    for anchor in soup.select("a[href]"):
        if clean_text(anchor.get_text(" ", strip=True)) == target_text:
            href = anchor.get("href")
            if href:
                return urljoin(base_url, href).split("#", 1)[0]

    fallback_path = "pop" if mode == "category-popular" else "time"
    return f"{BASE_URL}/category/{category_id}/{fallback_path}/"


def build_list_urls(
    page: Page,
    mode: str,
    category_id: str | None,
    pages: int,
    timeout_ms: int,
) -> list[str]:
    if mode == "weekly":
        return [f"{BASE_URL}/explore/"]
    if not category_id:
        raise ValueError("分类模式必须提供 --category-id，例如 40076。")

    sort_url = discover_category_sort_url(page, mode, category_id, timeout_ms)
    return [add_page_number(sort_url, number) for number in range(1, pages + 1)]


def extract_recipe_links(html: str, list_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    containers = soup.select("div.normal-recipe-list")
    roots: list[Tag | BeautifulSoup] = containers or [soup]
    links: list[str] = []
    seen: set[str] = set()

    for root in roots:
        for selector in (
            "p.name a[href*='/recipe/']",
            "li a[href*='/recipe/']",
            "a[href*='/recipe/']",
        ):
            found = False
            for anchor in root.select(selector):
                href = anchor.get("href")
                if not href:
                    continue
                absolute = urljoin(list_url, href).split("?", 1)[0]
                if not re.search(r"/recipe/\d+/?$", absolute):
                    continue
                canonical = absolute if absolute.endswith("/") else absolute + "/"
                if canonical not in seen:
                    seen.add(canonical)
                    links.append(canonical)
                    found = True
            if found:
                break
    return links


def find_recipe_json_ld(soup: BeautifulSoup) -> dict[str, Any] | None:
    def walk(value: Any) -> dict[str, Any] | None:
        if isinstance(value, dict):
            type_value = value.get("@type")
            if type_value == "Recipe" or (
                isinstance(type_value, list) and "Recipe" in type_value
            ):
                return value
            for child in value.values():
                found = walk(child)
                if found:
                    return found
        elif isinstance(value, list):
            for child in value:
                found = walk(child)
                if found:
                    return found
        return None

    for script in soup.select("script[type='application/ld+json']"):
        raw = script.string or script.get_text()
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        found = walk(data)
        if found:
            return found
    return None


def parse_iso_duration_minutes(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(
        r"P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?",
        value.strip(),
        flags=re.IGNORECASE,
    )
    if not match:
        return None
    days = int(match.group("days") or 0)
    hours = int(match.group("hours") or 0)
    minutes = int(match.group("minutes") or 0)
    seconds = int(match.group("seconds") or 0)
    total = days * 1440 + hours * 60 + minutes + (1 if seconds >= 30 else 0)
    return total or None


def parse_servings(value: Any) -> int | None:
    if isinstance(value, list):
        value = value[0] if value else None
    parsed = parse_int(value)
    if parsed is None:
        return None
    return min(max(parsed, 1), 50)


def classify_ingredient(name: str) -> tuple[str, str, str]:
    normalized = clean_text(name)
    ingredient_type = (
        "seasoning" if any(keyword in normalized for keyword in SEASONING_KEYWORDS) else "main"
    )

    category = "其他"
    for candidate, keywords in CATEGORY_RULES:
        if any(keyword in normalized for keyword in keywords):
            category = candidate
            break

    emoji = "🍽️"
    for candidate, keywords in EMOJI_RULES:
        if any(keyword in normalized for keyword in keywords):
            emoji = candidate
            break

    return ingredient_type, emoji, category


def split_ingredient(raw: str) -> tuple[str, str]:
    raw = clean_text(raw).replace("：", " ").replace(":", " ")
    raw = re.sub(r"\s+", " ", raw)
    if not raw:
        return "", ""

    trailing = re.match(
        rf"^(?P<name>.+?)[（(]?\s*(?P<amount>{AMOUNT_TOKEN})\s*[）)]?$",
        raw,
        flags=re.IGNORECASE,
    )
    if trailing and clean_text(trailing.group("name")):
        return clean_text(trailing.group("name")), clean_text(trailing.group("amount"))

    leading = re.match(
        rf"^(?P<amount>{AMOUNT_TOKEN})\s+(?P<name>.+)$",
        raw,
        flags=re.IGNORECASE,
    )
    if leading:
        return clean_text(leading.group("name")), clean_text(leading.group("amount"))

    parts = [clean_text(part) for part in re.split(r"\t+|\s{2,}", raw) if clean_text(part)]
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])

    return raw, "适量"


def build_ingredient(name: str, amount: str) -> Ingredient:
    ingredient_type, emoji, category = classify_ingredient(name)
    return Ingredient(
        name=clean_text(name),
        amount=clean_text(amount) or "适量",
        type=ingredient_type,
        emoji=emoji,
        category=category,
    )


def parse_dom_ingredients(soup: BeautifulSoup) -> list[Ingredient]:
    result: list[Ingredient] = []
    for row in soup.select(".ings tr, table.ings tr"):
        name = first_text(row, (".name a", ".name", "td:first-child"))
        amount = first_text(row, (".unit", "td:nth-child(2)"))
        if name:
            result.append(build_ingredient(name, amount))
    return result


def parse_json_ld_ingredients(value: Any) -> list[Ingredient]:
    if not isinstance(value, list):
        return []
    result: list[Ingredient] = []
    for raw in value:
        name, amount = split_ingredient(str(raw))
        if name:
            result.append(build_ingredient(name, amount))
    return result


def parse_json_ld_steps(value: Any) -> list[str]:
    raw_steps = value if isinstance(value, list) else ([value] if value else [])
    result: list[str] = []

    def append_step(text: Any) -> None:
        normalized = clean_text(str(text or ""))
        if normalized:
            result.append(normalized)

    for item in raw_steps:
        if isinstance(item, str):
            append_step(item)
        elif isinstance(item, dict):
            if item.get("@type") == "HowToSection":
                for child in item.get("itemListElement") or []:
                    if isinstance(child, dict):
                        append_step(child.get("text") or child.get("name"))
                    else:
                        append_step(child)
            else:
                append_step(item.get("text") or item.get("name"))
    return result


def parse_dom_steps(soup: BeautifulSoup) -> list[str]:
    result: list[str] = []
    for item in soup.select("div.steps ol li, .steps li"):
        paragraphs = [
            clean_text(p.get_text(" ", strip=True))
            for p in item.select("p")
            if clean_text(p.get_text(" ", strip=True))
        ]
        text = clean_text(" ".join(paragraphs)) or clean_text(item.get_text(" ", strip=True))
        if text:
            result.append(text)
    return result


def normalize_category_values(value: Any) -> list[str]:
    if isinstance(value, str):
        values = re.split(r"[,，/、|]", value)
    elif isinstance(value, list):
        values = [str(item) for item in value]
    else:
        values = []
    return [clean_text(item) for item in values if clean_text(item)]


def choose_recipe_category(name: str, source_categories: list[str]) -> str:
    title_rules = [
        ("饮品", ("饮料", "奶茶", "咖啡", "果汁", "茶饮", "冰饮")),
        ("汤羹", ("汤", "羹")),
        ("甜品", ("蛋糕", "饼干", "布丁", "慕斯", "甜品", "冰淇淋", "糖水")),
        ("烘焙", ("面包", "吐司", "曲奇", "烤")),
        ("主食", ("饭", "面", "粉", "粥", "饺子", "包子", "馒头", "饼")),
        ("凉菜", ("凉拌", "沙拉")),
    ]
    for category, keywords in title_rules:
        if any(keyword in name for keyword in keywords):
            return category
    return source_categories[0] if source_categories else "家常菜"


def infer_time(json_ld: dict[str, Any], step_count: int) -> int:
    total = parse_iso_duration_minutes(json_ld.get("totalTime"))
    if total is None:
        prep = parse_iso_duration_minutes(json_ld.get("prepTime")) or 0
        cook = parse_iso_duration_minutes(json_ld.get("cookTime")) or 0
        total = prep + cook or None
    if total is None:
        total = max(10, step_count * 5)
    return min(max(total, 5), 1440)


def infer_difficulty(time_minutes: int, step_count: int, ingredient_count: int) -> str:
    if time_minutes <= 30 and step_count <= 6 and ingredient_count <= 10:
        return "简单"
    if time_minutes <= 75 and step_count <= 10 and ingredient_count <= 16:
        return "中等"
    return "困难"


def build_summary(name: str, description: str, ingredients: list[Ingredient]) -> str:
    if description:
        return trim_text(description)
    main_names = [item.name for item in ingredients if item.type == "main"][:3]
    if main_names:
        return trim_text(f"{name}以{'、'.join(main_names)}为主要食材，适合家庭日常制作。")
    return trim_text(f"{name}是一道适合家庭制作的菜谱。")


def parse_tip(soup: BeautifulSoup, json_ld: dict[str, Any]) -> str:
    tip = first_text(
        soup,
        (".tip", ".tips", ".tip-container", ".recipe-tip", "section.tip"),
    )
    if tip:
        tip = re.sub(r"^(小贴士|小提示)\s*[:：]?\s*", "", tip)
        return trim_text(tip, 300)
    return ""


def download_image_as_jpeg(
    context: BrowserContext,
    image_url: str,
    image_dir: Path,
    recipe_id: str,
    timeout_ms: int,
) -> str:
    if not image_url:
        return ""

    relative_path = Path(image_dir.name) / f"{recipe_id}.jpg"
    target_path = image_dir / f"{recipe_id}.jpg"
    target_path.parent.mkdir(parents=True, exist_ok=True)

    if target_path.exists() and target_path.stat().st_size > 0:
        return relative_path.as_posix()

    response = context.request.get(
        image_url,
        headers={"Referer": BASE_URL + "/"},
        timeout=timeout_ms,
    )
    if response.status in (401, 403, 429):
        raise CrawlError(f"封面图片下载被拒绝，HTTP {response.status}")
    if not response.ok:
        raise CrawlError(f"封面图片下载失败，HTTP {response.status}")

    with Image.open(BytesIO(response.body())) as image:
        if getattr(image, "is_animated", False):
            image.seek(0)
        image.convert("RGB").save(target_path, format="JPEG", quality=90, optimize=True)

    return relative_path.as_posix()


def parse_recipe_detail(html: str, url: str) -> tuple[Recipe, str]:
    soup = BeautifulSoup(html, "lxml")
    json_ld = find_recipe_json_ld(soup) or {}

    id_match = re.search(r"/recipe/(\d+)/", url)
    source_id = id_match.group(1) if id_match else ""
    recipe_id = f"xiachufang-{source_id}" if source_id else ""

    name = clean_text(str(json_ld.get("name") or "")) or first_text(
        soup, ("h1.page-title", "h1")
    )
    if not name or not recipe_id:
        raise CrawlError(f"页面解析失败，菜名或菜谱ID缺失：{url}")

    description = clean_text(str(json_ld.get("description") or ""))
    if not description:
        meta = soup.select_one("meta[name='description']")
        description = clean_text(meta.get("content") if meta else "")

    image_url = normalize_image(json_ld.get("image"))
    if not image_url:
        image_url = normalize_image(
            first_attr(
                soup,
                ("div.recipe-show div.cover img", ".cover img", "meta[property='og:image']"),
                ("data-src", "data-original", "src", "content"),
            )
        )

    ingredients = parse_dom_ingredients(soup)
    if not ingredients:
        ingredients = parse_json_ld_ingredients(json_ld.get("recipeIngredient"))

    steps = parse_json_ld_steps(json_ld.get("recipeInstructions"))
    if not steps:
        steps = parse_dom_steps(soup)

    source_categories = normalize_category_values(json_ld.get("recipeCategory"))
    if not source_categories:
        source_categories = [
            clean_text(item.get_text(" ", strip=True))
            for item in soup.select(".recipe-cats a")
            if clean_text(item.get_text(" ", strip=True))
        ]

    time_minutes = infer_time(json_ld, len(steps))
    servings = parse_servings(json_ld.get("recipeYield")) or 2
    category = choose_recipe_category(name, source_categories)
    difficulty = infer_difficulty(time_minutes, len(steps), len(ingredients))

    recipe = Recipe(
        id=recipe_id,
        name=name,
        summary=build_summary(name, description, ingredients),
        image="",
        category=category,
        difficulty=difficulty,
        time=time_minutes,
        servings=servings,
        ingredients=ingredients,
        steps=steps,
        tip=parse_tip(soup, json_ld),
    )
    return recipe, image_url


def load_existing(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(data, list):
        return {}
    return {
        str(item.get("id")): item
        for item in data
        if isinstance(item, dict) and item.get("id")
    }


def save_json_atomic(path: Path, recipes: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(recipes, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary.replace(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="使用本机浏览器抓取下厨房公开榜单，并输出统一菜谱JSON。"
    )
    parser.add_argument(
        "--mode",
        choices=("weekly", "category-popular", "category-score"),
        default="weekly",
        help="weekly=本周热门；category-popular=分类最受欢迎；category-score=分类评分。",
    )
    parser.add_argument("--category-id", help="分类ID，例如家常菜为40076。")
    parser.add_argument("--pages", type=int, default=1, help="分类榜单页数，默认1。")
    parser.add_argument("--limit", type=int, default=20, help="最多抓取数量，默认20。")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="JSON输出路径。")
    parser.add_argument("--image-dir", default=DEFAULT_IMAGE_DIR, help="图片目录。")
    parser.add_argument("--no-download-images", action="store_true")
    parser.add_argument("--delay-min", type=float, default=DEFAULT_DELAY_MIN)
    parser.add_argument("--delay-max", type=float, default=DEFAULT_DELAY_MAX)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument(
        "--browser",
        choices=("msedge", "chrome", "chromium"),
        default="msedge",
        help="使用的浏览器。Windows默认msedge。",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="隐藏浏览器窗口。首次运行建议保持可见。",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="单个页面超时秒数，默认40。",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if args.limit <= 0:
        raise ValueError("--limit 必须大于0。")
    if args.pages <= 0:
        raise ValueError("--pages 必须大于0。")
    if args.delay_min < 2:
        raise ValueError("--delay-min 不应低于2秒。")
    if args.delay_max < args.delay_min:
        raise ValueError("--delay-max 必须大于或等于 --delay-min。")
    if args.timeout <= 0:
        raise ValueError("--timeout 必须大于0。")
    if args.mode != "weekly" and not args.category_id:
        raise ValueError("分类模式必须提供 --category-id。")


def main() -> int:
    args = parse_args()
    try:
        validate_args(args)
    except ValueError as exc:
        print(f"参数错误：{exc}", file=sys.stderr)
        return 2

    output_path = Path(args.output)
    image_dir = Path(args.image_dir)
    existing = {} if args.overwrite else load_existing(output_path)
    timeout_ms = args.timeout * 1000

    try:
        with sync_playwright() as playwright:
            launch_options: dict[str, Any] = {"headless": args.headless}
            if args.browser in ("msedge", "chrome"):
                launch_options["channel"] = args.browser

            try:
                browser = playwright.chromium.launch(**launch_options)
            except Exception as exc:
                if args.browser == "chromium":
                    message = (
                        "无法启动Playwright Chromium。请运行：\n"
                        "python -m playwright install chromium"
                    )
                else:
                    message = (
                        f"无法启动本机 {args.browser}。可改用 --browser chromium，"
                        "并先运行 python -m playwright install chromium。"
                    )
                raise CrawlError(message) from exc

            context = browser.new_context(
                locale="zh-CN",
                user_agent=USER_AGENT,
                viewport={"width": 1440, "height": 1000},
            )
            page = context.new_page()
            page.set_default_timeout(timeout_ms)

            try:
                print("[初始化] 使用浏览器访问下厨房首页并建立会话")
                try:
                    browser_fetch_html(page, BASE_URL + "/", timeout_ms)
                    polite_sleep(2.0, 3.0)
                except CrawlError as exc:
                    print(f"[初始化] 首页访问失败，继续尝试榜单页：{exc}")

                ranked_links: list[str] = []
                seen: set[str] = set()

                list_urls = build_list_urls(
                    page,
                    args.mode,
                    args.category_id,
                    args.pages,
                    timeout_ms,
                )

                for list_url in list_urls:
                    print(f"[榜单] {list_url}")
                    html = browser_fetch_html(page, list_url, timeout_ms)
                    links = extract_recipe_links(html, list_url)
                    if not links:
                        raise CrawlError(f"榜单页没有解析到菜谱链接：{list_url}")
                    for link in links:
                        if link not in seen:
                            seen.add(link)
                            ranked_links.append(link)
                    if len(ranked_links) >= args.limit:
                        break
                    polite_sleep(args.delay_min, args.delay_max)

                ranked_links = ranked_links[: args.limit]
                print(f"共发现 {len(ranked_links)} 道菜。")

                results: list[dict[str, Any]] = []

                for index, recipe_url in enumerate(ranked_links, start=1):
                    source_match = re.search(r"/recipe/(\d+)/", recipe_url)
                    source_id = source_match.group(1) if source_match else ""
                    recipe_id = f"xiachufang-{source_id}" if source_id else ""

                    if recipe_id in existing and not args.overwrite:
                        results.append(existing[recipe_id])
                        print(
                            f"[{index}/{len(ranked_links)}] 已存在："
                            f"{existing[recipe_id].get('name', recipe_id)}"
                        )
                        continue

                    polite_sleep(args.delay_min, args.delay_max)
                    print(f"[{index}/{len(ranked_links)}] 抓取：{recipe_url}")

                    try:
                        html = browser_fetch_html(page, recipe_url, timeout_ms)
                        recipe, image_url = parse_recipe_detail(html, recipe_url)

                        if not args.no_download_images and image_url:
                            polite_sleep(
                                max(1.0, args.delay_min / 2),
                                max(1.5, args.delay_max / 2),
                            )
                            try:
                                recipe.image = download_image_as_jpeg(
                                    context=context,
                                    image_url=image_url,
                                    image_dir=image_dir,
                                    recipe_id=recipe.id,
                                    timeout_ms=timeout_ms,
                                )
                            except (CrawlError, OSError) as exc:
                                print(f"  图片保存失败：{exc}", file=sys.stderr)

                        results.append(asdict(recipe))
                        save_json_atomic(output_path, results)
                        print(
                            f"  完成：{recipe.name}，"
                            f"用料{len(recipe.ingredients)}项，步骤{len(recipe.steps)}条"
                        )
                    except (PlaywrightTimeoutError, CrawlError, OSError) as exc:
                        print(f"  失败：{exc}", file=sys.stderr)

                save_json_atomic(output_path, results)
                print(f"\n完成：保存 {len(results)} 道菜。")
                print(f"JSON：{output_path.resolve()}")
                if not args.no_download_images:
                    print(f"图片目录：{image_dir.resolve()}")
                return 0
            finally:
                context.close()
                browser.close()

    except RateLimited as exc:
        print(str(exc), file=sys.stderr)
        return 3
    except (CrawlError, ValueError, PlaywrightTimeoutError) as exc:
        print(f"运行失败：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
