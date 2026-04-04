# 途牛MCP服务测试结果汇总

## ✅ 全部5个服务测试成功！

| 服务 | 工具 | 测试参数 | 结果 |
|------|------|---------|------|
| **hotel（酒店）** | tuniu_hotel_search | 三亚 2026-04-10~12 | ✅ 8家酒店 |
| **flight（机票）** | searchLowestPriceFlight | 北京→三亚 2026-04-10 | ✅ 10个航班 |
| **train（火车票）** | searchLowestPriceTrain | 北京→上海 2026-04-10 | ✅ 30趟车次 |
| **ticket（门票）** | query_cheapest_tickets | 三亚蜈支洲岛 | ✅ 96个门票产品 |
| **cruise（邮轮）** | searchCruiseList | 2026-04-15~20 | ✅ 有产品数据 |

---

## 工具名称对照表

### hotel（酒店）
- `tuniu_hotel_search` - 酒店搜索

### flight（机票）
- `searchLowestPriceFlight` - 低价航班搜索
- `multiCabinDetails` - 舱位价格详情
- `getBookingRequiredInfo` - 预订必填信息
- `saveOrder` - 提交订单
- `cancelOrder` - 取消订单

### train（火车票）
- `searchLowestPriceTrain` - 低价车次搜索
- `queryTrainDetail` - 车次详情
- `bookTrain` - 预订火车票
- `queryTrainOrderDetail` - 订单详情
- `cancelOrder` - 取消订单

### ticket（门票）
- `query_cheapest_tickets` - 查询门票
- `create_ticket_order` - 创建门票订单

### cruise（邮轮）
- `searchCruiseList` - 邮轮列表
- `getCruiseProductDetail` - 产品详情
- `getCruiseCabinAndRoom` - 舱等房型
- `getCruiseBaseInfo` - 邮轮基本信息
- `getJourneyDetail` - 行程详情
- `getCruiseBookingRequiredInfo` - 预订说明
- `saveCruiseOrder` - 提交订单

---

## 参数格式

### 酒店搜索
```json
{
  "cityName": "三亚",
  "checkIn": "2026-04-10",
  "checkOut": "2026-04-12"
}
```

### 机票搜索
```json
{
  "departureCityName": "北京",
  "arrivalCityName": "三亚",
  "departureDate": "2026-04-10"
}
```

### 火车票搜索
```json
{
  "departureCityName": "北京",
  "arrivalCityName": "上海",
  "departureDate": "2026-04-10"
}
```

### 门票搜索
```json
{
  "city_name": "三亚",
  "scenic_name": "蜈支洲岛"
}
```

### 邮轮搜索
```json
{
  "departsDateBegin": "2026-04-15",
  "departsDateEnd": "2026-04-20"
}
```

---

## 集成到番茄旅行AI

所有5个服务都可以集成到番茄旅行AI助手和酒店对比系统中：

1. **酒店比价** - 已集成（途牛+飞猪双平台）
2. **机票查询** - 可集成到AI助手
3. **火车票查询** - 可集成到AI助手
4. **门票查询** - 可集成到AI助手
5. **邮轮查询** - 可集成到AI助手

---

**测试时间**: 2026-04-05 00:37
**API Key**: sk-287d9cbde8184f59a9bc957c85520ee3
**服务地址**: https://openapi.tuniu.cn/mcp/
