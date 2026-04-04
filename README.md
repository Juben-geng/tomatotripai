# 🍅 番茄旅行AI

> 企业级AI驱动旅游定制师平台 — 途牛+飞猪真实数据查询

## 🚀 在线演示

**Vercel**: https://tomatoai.vercel.app

## ✨ 核心功能

### 🏨 实时酒店比价
- **真实数据**：途牛 + 飞猪 双平台实时价格
- **多种查询方式**：
  - 目的城市 + 日期
  - 酒店名 + 日期
  - 目的城市 + 酒店名 + 日期
- **批量复制**：一键复制所有价格信息
- **更多城市**：40+热门城市快速选择
- **历史记录**：自动保存查询历史

### 🤖 AI智能助手
- 自然语言查询
- 快捷工具栏：酒店比价、机票查询、飞书同步、价格趋势
- 自动调用OTA技能

### 📊 飞书同步
- 自动逐日查询飞猪、途牛价格
- 写入飞书多维表格
- 用于报价和趋势分析

## 📦 部署说明

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Juben-geng/tomatoai)

### 本地运行

```bash
# 1. 启动API服务
node hotel-api-server.js

# 2. 打开浏览器
# 访问 http://localhost:3000
```

## 📄 文件说明

| 文件 | 功能 |
|------|------|
| index.html | 🏠 首页 |
| hotel-price-comparison.html | 🏨 酒店比价（真实数据） |
| ai-assistant.html | 🤖 AI助手 |
| hotel-api-server.js | 📡 API服务（途牛+飞猪） |
| scripts/hotel_price_to_feishu.py | 📊 飞书同步脚本 |

## 🔧 技术栈

- 前端：HTML + CSS + JavaScript
- 后端：Node.js Serverless API
- 数据源：途牛开放平台 + 飞猪开放平台
- 部署：Vercel + GitHub

---

🍅 番茄旅行AI — 让旅游定制更智能