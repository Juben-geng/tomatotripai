import urllib.request
import json
from urllib.parse import quote

# 测试酒店查询API
dest = quote('三亚')
url = f'http://localhost:3000/api/hotel/search?destName={dest}&checkIn=2026-04-05&checkOut=2026-04-07'
res = urllib.request.urlopen(url)
data = json.loads(res.read().decode('utf-8'))

print('=' * 50)
print('API Test Result')
print('=' * 50)
print(f'Status: {data["status"]}')
print(f'Dest: {data["data"]["destName"]}')
print(f'CheckIn: {data["data"]["checkIn"]}')
print(f'CheckOut: {data["data"]["checkOut"]}')
print(f'Total Hotels: {len(data["data"]["hotels"])}')
print(f'Tuniu: {data["meta"]["tuniuCount"]}')
print(f'Fliggy: {data["meta"]["flyaiCount"]}')
print('=' * 50)
print('\nTop 5 Hotels:\n')

for i, hotel in enumerate(data['data']['hotels'][:5], 1):
    print(f'{i}. {hotel["name"]}')
    print(f'   Price: {hotel["price"]}/night')
    print(f'   Source: {hotel["src"]}')
    print(f'   Score: {hotel.get("score", "N/A")}')
    print()

print('SUCCESS!')