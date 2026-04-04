import urllib.request
import json
from urllib.parse import quote

# 测试酒店查询API - 检查预订链接
dest = quote('三亚')
url = f'http://localhost:3000/api/hotel/search?destName={dest}&checkIn=2026-04-05&checkOut=2026-04-07'
res = urllib.request.urlopen(url)
data = json.loads(res.read().decode('utf-8'))

print('=' * 60)
print('Hotel Booking Links Test')
print('=' * 60)

for i, hotel in enumerate(data['data']['hotels'][:5], 1):
    print(f'\n{i}. {hotel["name"]}')
    print(f'   Price: {hotel["price"]}/night')
    print(f'   Source: {hotel["src"]}')
    print(f'   URL: {hotel.get("url", "N/A")}')
    print(f'   Has URL: {"YES" if hotel.get("url") else "NO"}')
    if hotel.get("url"):
        # 检查URL是否包含必要参数
        url_str = hotel["url"]
        has_params = '?' in url_str or 'keyword=' in url_str or 'checkin=' in url_str
        print(f'   Has Params: {"YES" if has_params else "NO"}')

print('\n' + '=' * 60)
print('Summary:')
total = len(data['data']['hotels'])
with_url = sum(1 for h in data['data']['hotels'] if h.get('url'))
print(f'Total Hotels: {total}')
print(f'With Booking URL: {with_url}')
print(f'Without URL: {total - with_url}')