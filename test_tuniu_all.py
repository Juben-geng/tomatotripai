# -*- coding: utf-8 -*-
import subprocess
import json
import sys
import os

os.environ['TUNIU_API_KEY'] = 'sk-287d9cbde8184f59a9bc957c85520ee3'

service = sys.argv[1] if len(sys.argv) > 1 else 'hotel'
tool = sys.argv[2] if len(sys.argv) > 2 else 'tuniu_hotel_search'

# 不同服务的参数模板
params = {
    'hotel': {"cityName": "三亚", "checkIn": "2026-04-10", "checkOut": "2026-04-12"},
    'flight': {"fromCity": "北京", "toCity": "三亚", "date": "2026-04-10"},
    'train': {"fromStation": "北京", "toStation": "三亚", "date": "2026-04-10"},
    'ticket': {"cityName": "三亚", "keyword": "蜈支洲岛"},
    'cruise': {"departureCity": "上海", "date": "2026-04-15"}
}

args = params.get(service, {})
args_json = json.dumps(args, ensure_ascii=False)

print(f"\n{'='*60}")
print(f"途牛服务测试: {service}")
print(f"工具: {tool}")
print(f"参数: {args_json}")
print('='*60)

cmd = f'tuniu call {service} {tool} --args "{args_json}"'

try:
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', timeout=30, shell=True)
    data = json.loads(result.stdout)
    
    if data.get('success'):
        print(f"✅ 成功!")
        content = data.get('result', {}).get('content', [{}])[0].get('text', '')
        if content:
            inner = json.loads(content)
            print(f"消息: {inner.get('message', 'N/A')}")
            if 'hotels' in inner:
                print(f"酒店数: {len(inner['hotels'])}")
            elif 'flights' in inner:
                print(f"航班数: {len(inner['flights'])}")
            elif 'trains' in inner:
                print(f"车次数: {len(inner['trains'])}")
            elif 'tickets' in inner:
                print(f"门票数: {len(inner['tickets'])}")
            elif 'cruises' in inner:
                print(f"邮轮数: {len(inner['cruises'])}")
    else:
        print(f"❌ 失败: {data.get('error', {}).get('message', 'Unknown')}")
except Exception as e:
    print(f"❌ 异常: {e}")
