#!/usr/bin/env python3
"""
番茄旅行 OTA 酒店价格 → 飞书表格同步脚本
调用 use_skill("ota-hotel-flight-query") 获取价格并写入飞书

关键教训: Windows下Python子进程调用npx/.cmd会输出为空
→ 必须用 node.exe 脚本绝对路径直调
"""

import subprocess
import json
import sys
import os
from datetime import datetime, timedelta

# ==================== 配置区域 ====================
# 修改以下参数后运行

DEST_NAME = "三亚"          # 目的地城市
KEY_WORDS = "天域"         # 酒店关键词（可选）
START_DATE = "2026-04-11"  # 开始日期 (YYYY-MM-DD)
NIGHTS = 3                 # 查询连续多少天的价格

# 飞书表格配置 (从飞书多维表格获取)
BASE_TOKEN = "YOUR_BASE_TOKEN"  # 表格的 base_token
TABLE_DAILY = "YOUR_TABLE_ID"   # 数据表的 table_id

# Node.js 和 flyai-cli 路径 (Windows必须指定绝对路径)
NODE_EXE = "node"  # 或 "C:\\Program Files\\nodejs\\node.exe"
FLYAI_CLI_PATH = os.path.expanduser("~\\AppData\\Roaming\\npm\\node_modules\\flyai-cli\\index.js")
# 如果上面路径不对，可以用: npx flyai (但Windows可能输出为空)

# API 服务地址 (如果使用本地API服务)
API_URL = "http://localhost:3000"

# ==================== 函数定义 ====================

def get_price_color(price):
    """根据价格返回颜色等级"""
    if price <= 500:
        return "🟢 经济"
    elif price <= 1500:
        return "🟠 舒适"
    elif price <= 3000:
        return "🔴 高档"
    else:
        return "🟣 豪华"


def call_ota_skill(dest, keywords, check_in, check_out):
    """
    调用 OTA 技能查询酒店价格
    方式1: 直接调用 flyai-cli (推荐，但Windows需注意路径)
    方式2: 调用本地API服务
    """
    print(f"🔍 查询: {dest} {keywords} | {check_in} ~ {check_out}")
    
    # 方式1: 直接调用 flyai-cli (Windows下必须用node直调)
    try:
        # 构建命令 - Windows下必须用 node 直调，不能用 npx
        cmd = [
            NODE_EXE,
            FLYAI_CLI_PATH,
            "search-hotels",
            "--dest-name", dest,
            "--check-in-date", check_in,
            "--check-out-date", check_out,
        ]
        if keywords:
            cmd.extend(["--key-words", keywords])
        
        print(f"执行: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=60
        )
        
        # 解析输出
        output = result.stdout.strip()
        # 找到JSON开始的位置
        json_start = output.find('{')
        if json_start >= 0:
            output = output[json_start:]
        
        data = json.loads(output)
        
        if 'data' in data and 'itemList' in data['data']:
            hotels = data['data']['itemList']
            return [
                {
                    'name': h.get('name', ''),
                    'star': h.get('star', ''),
                    'price': int(str(h.get('price', '0')).replace('¥', '').replace(',', '')),
                    'score': h.get('score', ''),
                    'src': '飞猪',
                    'address': h.get('address', ''),
                    'url': h.get('detailUrl', '')
                }
                for h in hotels
            ]
    except Exception as e:
        print(f"方式1失败: {e}")
    
    # 方式2: 调用本地API服务
    try:
        import urllib.request
        import urllib.parse
        
        params = urllib.parse.urlencode({
            'destName': dest,
            'keyWords': keywords,
            'checkIn': check_in,
            'checkOut': check_out
        })
        
        url = f"{API_URL}/api/hotel/search?{params}"
        print(f"尝试API: {url}")
        
        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            if data.get('status') == 0 and data.get('data', {}).get('hotels'):
                return data['data']['hotels']
    except Exception as e:
        print(f"方式2失败: {e}")
    
    return []


def write_to_feishu(hotels, date_str):
    """
    写入飞书表格
    这里需要根据飞书API实现，示例为打印到控制台
    """
    print(f"\n📊 {date_str} 价格数据 ({len(hotels)}家酒店):")
    print("-" * 80)
    print(f"{'排名':<4} {'酒店名称':<25} {'平台':<8} {'价格':<10} {'等级':<10}")
    print("-" * 80)
    
    for i, hotel in enumerate(hotels[:20], 1):
        price_color = get_price_color(hotel['price'])
        print(f"{i:<4} {hotel['name'][:24]:<25} {hotel.get('src', '飞猪'):<8} ¥{hotel['price']:<9} {price_color}")
    
    print("-" * 80)
    
    # TODO: 实际飞书API调用
    # 参考: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/create
    if BASE_TOKEN != "YOUR_BASE_TOKEN":
        print(f"\n📝 正在写入飞书表格...")
        # 这里添加实际的飞书API调用代码
        # 需要安装: pip install lark-oapi
        # 使用 lark-oapi 库写入数据
        pass
    else:
        print(f"\n⚠️ 未配置飞书TOKEN，仅打印到控制台")
        print(f"   请修改脚本中的 BASE_TOKEN 和 TABLE_DAILY")


def main():
    """主函数：逐日查询价格并写入飞书"""
    print("=" * 60)
    print("🍅 番茄旅行 OTA 酒店价格同步工具")
    print("=" * 60)
    print(f"目的地: {DEST_NAME}")
    print(f"关键词: {KEY_WORDS or '无'}")
    print(f"开始日期: {START_DATE}")
    print(f"连续查询: {NIGHTS} 天")
    print("=" * 60)
    
    start_date = datetime.strptime(START_DATE, "%Y-%m-%d")
    
    all_data = []
    
    for day in range(NIGHTS):
        check_in = (start_date + timedelta(days=day)).strftime("%Y-%m-%d")
        check_out = (start_date + timedelta(days=day + 1)).strftime("%Y-%m-%d")
        
        print(f"\n📅 查询日期: {check_in} ~ {check_out}")
        
        # 调用OTA技能
        hotels = call_ota_skill(DEST_NAME, KEY_WORDS, check_in, check_out)
        
        if hotels:
            # 按价格排序
            hotels.sort(key=lambda x: x['price'])
            
            # 写入飞书
            write_to_feishu(hotels, check_in)
            
            all_data.append({
                'date': check_in,
                'hotels': hotels
            })
        else:
            print(f"❌ 未获取到数据")
    
    # 汇总
    print("\n" + "=" * 60)
    print("📊 查询完成!")
    print(f"共查询 {len(all_data)} 天价格数据")
    
    if all_data:
        total_hotels = sum(len(d['hotels']) for d in all_data)
        print(f"共获取 {total_hotels} 条酒店价格记录")
        
        # 找出最低价
        all_prices = []
        for d in all_data:
            for h in d['hotels']:
                all_prices.append({
                    'date': d['date'],
                    'name': h['name'],
                    'price': h['price']
                })
        
        if all_prices:
            cheapest = min(all_prices, key=lambda x: x['price'])
            print(f"\n🏆 全网最低价:")
            print(f"   {cheapest['date']} | {cheapest['name']} | ¥{cheapest['price']}")
    
    print("=" * 60)


if __name__ == "__main__":
    main()
