import os
import json
import re
from datetime import datetime
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pymysql

app = FastAPI(title="甜点幻想曲·开心消不停")

# CORS 配置 - 允许所有来源（方便手机微信访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def parse_database_url(url):
    """解析 DATABASE_URL 或 MYSQL_URL 格式的连接字符串"""
    # 格式: mysql://user:password@host:port/database
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "127.0.0.1",
        "port": parsed.port or 3306,
        "user": parsed.username or "root",
        "password": parsed.password or "",
        "database": parsed.path.lstrip("/") if parsed.path else "railway",
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


# 数据库配置 - 优先使用 DATABASE_URL/MYSQL_URL（Railway），否则使用独立环境变量
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("MYSQL_URL") or os.environ.get("MYSQLDATABASE_URL")

if DATABASE_URL:
    DB_CONFIG = parse_database_url(DATABASE_URL)
else:
    DB_CONFIG = {
        "host": os.environ.get("MYSQL_HOST", os.environ.get("MYSQLHOST", "127.0.0.1")),
        "port": int(os.environ.get("MYSQL_PORT", os.environ.get("MYSQLPORT", 3306))),
        "user": os.environ.get("MYSQL_USER", os.environ.get("MYSQLUSER", "root")),
        "password": os.environ.get("MYSQL_PASSWORD", os.environ.get("MYSQLPASSWORD", "")),
        "database": os.environ.get("MYSQL_DATABASE", os.environ.get("MYSQLDATABASE", "railway")),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def get_db():
    """获取数据库连接"""
    return pymysql.connect(**DB_CONFIG)


def init_database():
    """自动创建数据库表（如果不存在）"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        # 创建玩家表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                eng_name VARCHAR(100) DEFAULT '',
                is_enterprise BOOLEAN DEFAULT FALSE,
                level INT DEFAULT 1,
                exp INT DEFAULT 0,
                coins INT DEFAULT 500,
                total_score INT DEFAULT 0,
                max_combo INT DEFAULT 0,
                levels_cleared TEXT,
                achievements TEXT,
                tools TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        # 创建排行榜表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rankings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                player_name VARCHAR(50) NOT NULL,
                rank_type VARCHAR(20) NOT NULL DEFAULT 'score',
                rank_value INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_player_type (player_name, rank_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        conn.commit()
        cursor.close()
        conn.close()
        print("✅ 数据库表初始化成功")
    except Exception as e:
        print(f"⚠️ 数据库初始化失败: {e}")
        print(f"   数据库配置: host={DB_CONFIG.get('host')}, port={DB_CONFIG.get('port')}, database={DB_CONFIG.get('database')}")


# 启动时自动建表
@app.on_event("startup")
async def startup_event():
    init_database()


# ===== 数据模型 =====
class PlayerSaveRequest(BaseModel):
    name: str
    eng_name: Optional[str] = ""
    is_enterprise: Optional[bool] = False
    level: Optional[int] = 1
    exp: Optional[int] = 0
    coins: Optional[int] = 500
    total_score: Optional[int] = 0
    max_combo: Optional[int] = 0
    levels_cleared: Optional[str] = "{}"
    achievements: Optional[str] = "[]"
    tools: Optional[str] = '{"shuffle":3}'


# ===== 根路径重定向 =====
@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")


# ===== 健康检查 =====
@app.get("/health")
async def health():
    return {"status": "ok", "service": "dessert-fantasy"}


# ===== API接口 =====
@app.post("/api/player/save")
async def save_player(data: PlayerSaveRequest):
    """保存玩家数据"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        sql = """
            INSERT INTO players (name, eng_name, is_enterprise, level, exp, coins, 
                total_score, max_combo, levels_cleared, achievements, tools)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                eng_name = VALUES(eng_name),
                is_enterprise = VALUES(is_enterprise),
                level = GREATEST(level, VALUES(level)),
                exp = VALUES(exp),
                coins = VALUES(coins),
                total_score = GREATEST(total_score, VALUES(total_score)),
                max_combo = GREATEST(max_combo, VALUES(max_combo)),
                levels_cleared = VALUES(levels_cleared),
                achievements = VALUES(achievements),
                tools = VALUES(tools)
        """
        cursor.execute(sql, (
            data.name, data.eng_name, data.is_enterprise,
            data.level, data.exp, data.coins,
            data.total_score, data.max_combo,
            data.levels_cleared, data.achievements, data.tools
        ))
        conn.commit()

        # 同时更新排行榜
        update_rankings(cursor, data.name, data.total_score, data.level, data.levels_cleared)
        conn.commit()

        cursor.close()
        conn.close()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/player/load")
async def load_player(name: str):
    """加载玩家数据"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM players WHERE name = %s", (name,))
        player = cursor.fetchone()
        cursor.close()
        conn.close()

        if player:
            if player.get("created_at"):
                player["created_at"] = player["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if player.get("updated_at"):
                player["updated_at"] = player["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
            return player
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rankings")
async def get_rankings(type: str = "score"):
    """获取排行榜"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        valid_types = ["score", "level", "stars"]
        rank_type = type if type in valid_types else "score"

        cursor.execute(
            "SELECT player_name as name, rank_value as value FROM rankings "
            "WHERE rank_type = %s ORDER BY rank_value DESC LIMIT 20",
            (rank_type,)
        )

        results = cursor.fetchall()
        cursor.close()
        conn.close()

        rankings = []
        avatars = ['🧑‍🍳', '👩‍🍳', '👨‍🍳', '🧁', '🍰']
        for i, r in enumerate(results):
            rankings.append({
                "rank": i + 1,
                "name": r["name"],
                "value": r["value"],
                "avatar": avatars[i % len(avatars)]
            })

        return rankings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def update_rankings(cursor, name, total_score, level, levels_cleared_str):
    """更新排行榜数据"""
    total_stars = 0
    cleared_count = 0
    try:
        levels_cleared = json.loads(levels_cleared_str) if levels_cleared_str else {}
        for v in levels_cleared.values():
            if isinstance(v, dict):
                total_stars += v.get("stars", 0)
                if v.get("cleared"):
                    cleared_count += 1
    except (json.JSONDecodeError, AttributeError):
        pass

    cursor.execute(
        "INSERT INTO rankings (player_name, rank_type, rank_value) VALUES (%s, 'score', %s) "
        "ON DUPLICATE KEY UPDATE rank_value = GREATEST(rank_value, VALUES(rank_value))",
        (name, total_score)
    )

    cursor.execute(
        "INSERT INTO rankings (player_name, rank_type, rank_value) VALUES (%s, 'level', %s) "
        "ON DUPLICATE KEY UPDATE rank_value = GREATEST(rank_value, VALUES(rank_value))",
        (name, cleared_count)
    )

    cursor.execute(
        "INSERT INTO rankings (player_name, rank_type, rank_value) VALUES (%s, 'stars', %s) "
        "ON DUPLICATE KEY UPDATE rank_value = GREATEST(rank_value, VALUES(rank_value))",
        (name, total_stars)
    )


# 静态文件挂载 - 必须放在最后
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
