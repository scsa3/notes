"""Build public game data from local Steam exports using explicit field lists."""

import argparse
import csv
import json
from pathlib import Path


RECOMMENDATIONS = [
    {"appid": 1527950, "category": "隊伍戰術", "label": "最先推薦", "reason": "帶領傭兵隊伍探索世界，培養角色、規劃補給與回合戰術。隊伍養成和經營帶來長期投入的空間。", "evidence_appids": [1086940, 294100]},
    {"appid": 597180, "category": "歷史策略", "label": "特價首選", "reason": "帝國經營結合王朝、人物與宮廷事件。從歷史戰略到家族傳承，適合慢慢經營一段長篇歷史。", "evidence_appids": [872410, 779340]},
    {"appid": 3265700, "headerImage": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3265700/5590e42cab09dacabee973dd2c3e27ef12ed4950/header.jpg", "category": "構築循環", "label": "熟悉的新玩法", "reason": "吸血鬼倖存者系列的回合制牌組構築作品，把熟悉的成長節奏帶進地城與連擊組合。", "evidence_appids": [1794680, 646570]},
    {"appid": 2646320, "category": "武俠江湖", "label": "題材最貼近", "reason": "經營門派、招募人才、部署戰略與爭奪地域。把江湖角色養成和勢力經營放在同一段旅程。", "evidence_appids": [1876890, 952860]},
    {"appid": 1094520, "category": "開放世界", "label": "低價探索", "reason": "自由探索的沙漠沙盒 RPG，透過角色成長與自己的選擇，決定世界接下來的走向。", "evidence_appids": [952860, 779340]},
    {"appid": 3405340, "category": "構築循環", "label": "短局也過癮", "reason": "面對大量敵人，反覆升級與配裝，享受能力越滾越大的循環。適合想換一種戰鬥節奏的時候。", "evidence_appids": [1794680, 1145360]},
    {"appid": 763890, "category": "隊伍戰術", "label": "角色故事", "reason": "英雄會成長、衰老，戰術與選擇會改變人物和故事。讓每一支隊伍留下自己的回憶。", "evidence_appids": [1086940, 1859910]},
    {"appid": 2623190, "headerImage": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2623190/a7cee9165bb1bfc092c390c5cff215ce0e381dfc/header.jpg", "category": "開放世界", "label": "長篇冒險", "reason": "重返賽瑞迪爾，投入另一個大型自由探索世界。適合想好好展開一段長篇角色扮演冒險時選擇。", "evidence_appids": [72850, 377160]},
]


def number(value):
    return float(value) if value not in ("", None) else None


def review_fields(row):
    count = number(row.get("review_count"))
    return {
        "reviewPercent": number(row.get("review_positive_percent")),
        "reviewDescription": row.get("review_description") or None,
        "reviewCount": int(count) if count is not None else None,
        "reviewChecked": row.get("review_checked_at") or None,
        "reviewStatus": row.get("review_status") or None,
    }


def build(library_path, wishlist_path, prices_path):
    library = json.loads(library_path.read_text(encoding="utf-8"))
    wishlist = json.loads(wishlist_path.read_text(encoding="utf-8"))
    with prices_path.open(encoding="utf-8", newline="") as handle:
        prices = {int(row["appid"]): row for row in csv.DictReader(handle)}
    # Never copy SteamID, owner IDs, group IDs, credentials or raw metadata.
    games = [{
        "appid": row["appid"], "name": row["game_name"],
        "owned": row["owned_by_me"], "hours": row["my_playtime_hours"],
        "firstPlayed": row["first_played"], "lastPlayed": row["last_played"],
        **review_fields(row),
    } for row in library["games"]]
    items = []
    for row in wishlist["items"]:
        price = prices.get(row["appid"], {})
        items.append({
            "appid": row["appid"], "name": row["game_name"],
            "priority": row["priority"], "added": row["date_added"],
            "price": number(price.get("current_price")),
            "originalPrice": number(price.get("original_price")),
            "discount": number(price.get("discount_percent")),
            "currency": price.get("currency") or None,
            "country": price.get("country_code") or None,
            "priceChecked": price.get("price_checked_at") or None,
            "priceStatus": price.get("price_status") or None,
            "offer": price.get("purchase_option_name") or None,
            **review_fields(row if "review_status" in row else price),
        })
    lookup = {g["appid"]: g for g in games}
    wish_lookup = {g["appid"]: g for g in items}
    recommendations = []
    for rank, recommendation in enumerate(RECOMMENDATIONS, 1):
        appid = recommendation["appid"]
        if appid not in wish_lookup:
            continue
        rec = {key: value for key, value in recommendation.items() if key != "evidence_appids"}
        rec.update(rank=rank, evidence=[{
            "name": lookup[e]["name"], "hours": lookup[e]["hours"],
        } for e in recommendation["evidence_appids"] if e in lookup])
        recommendations.append(rec)
    dates = [p["priceChecked"] for p in items if p["priceChecked"]]
    review_dates = [row["reviewChecked"] for row in games + items if row["reviewChecked"]]
    return {
        "reviewsUpdated": max(review_dates) if review_dates else None,
        "updated": max(dates) if dates else library["metadata"]["exported_at"],
        "libraryUpdated": library["metadata"]["exported_at"],
        "wishlistUpdated": wishlist["metadata"]["exported_at"],
        "recommendationDate": "2026-10-08",
        "recommendationSaleEnd": "2026-10-09T01:00:00+08:00",
        "library": games, "wishlist": items, "recommendations": recommendations,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, required=True)
    parser.add_argument("--wishlist", type=Path, required=True)
    parser.add_argument("--prices", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets/js/data.js")
    args = parser.parse_args()
    data = build(args.library, args.wishlist, args.prices)
    content = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    if "7656119" in content or "/Users/" in content or "access_token" in content:
        raise SystemExit("Output contains a private identifier or local path; refusing to write.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("window.GAMES_DATA = " + content + ";\n", encoding="utf-8")
    print(f"Exported {len(data['library'])} games, {len(data['wishlist'])} wishlist items, {len(data['recommendations'])} recommendations.")


if __name__ == "__main__":
    main()
