#!/usr/bin/env node
/**
 * 番茄旅行 OTA 统一 API 服务
 * 途牛 tuniu-cli + 飞猪 @fly-ai/flyai-cli
 * 启动: node hotel-api-server.js  或  npm start
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

const ota = require('./lib/ota_engine');
const feishu = require('./lib/feishu_open');
const feishuCli = require('./lib/feishu_cli');
const member = require('./lib/membership_store');
const creative = require('./lib/creative_pipeline');
const cms = require('./lib/cms_store');

// 加载环境变量
require('dotenv').config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'tomato-admin-dev';

// 管理员账号从环境变量读取，不在代码中硬编码
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const crypto = require('crypto');
function makeToken(email) {
  const payload = email + ':' + Date.now();
  return crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
}

const CORS_JSON = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, X-Member-Key, x-admin-secret, X-Tomato-Vip, Accept, Authorization, Origin',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

function sendJSON(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_JSON,
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function getMemberKey(req) {
  const h = req.headers['x-member-key'] || req.headers['X-Member-Key'];
  return h && String(h).trim() ? String(h).trim() : '';
}

function parseCliCreative(raw) {
  if (!raw || typeof raw !== 'string') return { parsed: null, raw: '' };
  const t = raw.trim();
  try {
    const parsed = JSON.parse(t);
    return { parsed, raw: t };
  } catch (e) {
    const m = t.match(/\{[\s\S]*\}\s*$/);
    if (m) {
      try {
        return { parsed: JSON.parse(m[0]), raw: t };
      } catch (e2) {}
    }
    return { parsed: { message: t }, raw: t };
  }
}

async function adminOk(req) {
  let s = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'];
  if (!s && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      s = body.adminSecret || body.xAdminSecret;
    } catch (e) {
      // 如果读取body失败，继续使用header中的值
    }
  }
  return s && String(s) === ADMIN_SECRET;
}

function sendFile(res, filePath, root) {
  const fullPath = path.join(root || __dirname, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
  };
  const mime = MIME[ext] || 'text/plain; charset=utf-8';
  try {
    const content = fs.readFileSync(fullPath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => {
      chunks.push(c);
      if (Buffer.concat(chunks).length > 2 * 1024 * 1024) {
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function defaultDates() {
  const today = new Date();
  const out = new Date(today);
  out.setDate(out.getDate() + 2);
  return {
    checkIn: today.toISOString().slice(0, 10),
    checkOut: out.toISOString().slice(0, 10),
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_JSON);
    res.end();
    return;
  }

  try {
    if (pathname === '/health') {
      const flyaiPath = ota.getFlyaiCliPath();
      const hasKey = !!process.env.TUNIU_API_KEY;
      sendJSON(res, 200, {
        status: 'ok',
        service: '番茄旅行OTA',
        skill: 'ota-hotel-flight-query',
        tuniuApiKey: hasKey ? 'configured' : 'missing',
        tuniuCli: 'use `tuniu list` locally',
        flyai: flyaiPath ? 'available' : 'not-found',
        flyaiPath: flyaiPath || null,
        feishu: process.env.FEISHU_APP_ID && process.env.FEISHU_BASE_TOKEN ? 'configured' : 'optional',
        membership: 'enabled',
        creative: '/api/creative/image',
        time: new Date().toISOString(),
      });
      return;
    }

    // —— 会员：公开配置 / 当前用户 / 演示充值 ——
    if (pathname === '/api/member/config' && req.method === 'GET') {
      sendJSON(res, 200, { status: 0, data: member.publicConfig() });
      return;
    }

    if (pathname === '/api/member/me' && req.method === 'GET') {
      const mk = getMemberKey(req) || (parsedUrl.query && parsedUrl.query.key) || '';
      if (!mk) {
        sendJSON(res, 200, { status: 0, data: { anonymous: true, hint: '传 X-Member-Key 或使用 ?key=' } });
        return;
      }
      sendJSON(res, 200, { status: 0, data: member.publicUser(mk) });
      return;
    }

    if (pathname === '/api/member/usage-history' && req.method === 'GET') {
      const mk = getMemberKey(req) || (parsedUrl.query && parsedUrl.query.key) || '';
      if (!mk) {
        sendJSON(res, 400, { success: false, error: '缺少 X-Member-Key' });
        return;
      }

      // 获取用户使用记录
      const user = member.ensureUser(mk);
      const history = [];

      if (user && user.history) {
        // 转换历史记录为前端格式
        user.history.forEach(record => {
          let type = '未知';
          if (record.action === 'ai_chat') type = 'AI对话';
          else if (record.action === 'ota_query') type = 'OTA查询';
          else if (record.action === 'creative_image') type = '创意图片';
          else if (record.action === 'recharge') type = '充值积分';

          history.push({
            type: type,
            date: new Date(record.timestamp).toLocaleString('zh-CN'),
            cost: record.cost || null,
            timestamp: record.timestamp
          });
        });
      }

      // 按时间倒序排列
      history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      sendJSON(res, 200, {
        success: true,
        history: history.slice(0, 50)  // 最多返回50条
      });
      return;
    }

    if (pathname === '/api/member/recharge' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mk = getMemberKey(req) || body.memberKey || '';
      if (!mk) {
        sendJSON(res, 400, { status: 1, message: '缺少 X-Member-Key 或 memberKey' });
        return;
      }
      const r = member.applyRechargePackage(mk, body.packageId || body.id);
      if (!r.ok) {
        sendJSON(res, 400, { status: 1, message: '套餐不存在', detail: r });
        return;
      }
      sendJSON(res, 200, { status: 0, message: 'demo_recharge_ok', data: r });
      return;
    }

    // === CMS管理端点 ===

    // 获取所有CMS配置
    if (pathname === '/api/cms/config' && req.method === 'GET') {
      const config = cms.getAllConfig();
      sendJSON(res, 200, { success: true, data: config });
      return;
    }

    // 内容管理
    if (pathname === '/api/cms/content' && req.method === 'GET') {
      const content = cms.loadContent();
      sendJSON(res, 200, { success: true, data: content });
      return;
    }

    if (pathname === '/api/cms/content' && req.method === 'POST') {
      const body = await readJsonBody(req);
      cms.saveContent(body);
      sendJSON(res, 200, { success: true, message: '内容已保存' });
      return;
    }

    // 样式管理
    if (pathname === '/api/cms/style' && req.method === 'GET') {
      const style = cms.loadStyle();
      sendJSON(res, 200, { success: true, data: style });
      return;
    }

    if (pathname === '/api/cms/style' && req.method === 'POST') {
      const body = await readJsonBody(req);
      cms.saveStyle(body);
      sendJSON(res, 200, { success: true, message: '样式已保存' });
      return;
    }

    // 排版管理
    if (pathname === '/api/cms/layout' && req.method === 'GET') {
      const layout = cms.loadLayout();
      sendJSON(res, 200, { success: true, data: layout });
      return;
    }

    if (pathname === '/api/cms/layout' && req.method === 'POST') {
      const body = await readJsonBody(req);
      cms.saveLayout(body);
      sendJSON(res, 200, { success: true, message: '排版已保存' });
      return;
    }

    // 媒体管理
    if (pathname === '/api/cms/media' && req.method === 'GET') {
      const media = cms.loadMedia();
      sendJSON(res, 200, { success: true, data: media });
      return;
    }

    // 媒体上传（需要实现multipart/form-data处理）
    if (pathname === '/api/cms/media/upload' && req.method === 'POST') {
      // 注意：这是一个简化的实现
      // 实际生产环境需要使用formidable或multer等库处理文件上传
      sendJSON(res, 200, {
        success: true,
        message: '图片上传功能开发中，请使用URL添加',
        data: { images: [] }
      });
      return;
    }

    // 媒体删除
    if (pathname.match(/^\/api\/cms\/media\/[^/]+$/) && req.method === 'DELETE') {
      const imageId = pathname.split('/').pop();
      const success = cms.removeImage(imageId);
      if (success) {
        sendJSON(res, 200, { success: true, message: '图片已删除' });
      } else {
        sendJSON(res, 404, { success: false, error: '图片不存在' });
      }
      return;
    }

    // === AI聊天端点 ===

    // AI服务状态
    if (pathname === '/api/ai/status' && req.method === 'GET') {
      const { UnifiedAIService } = require('./lib/ai_service');
      const aiService = new UnifiedAIService();
      const status = aiService.getPlatformStatus();
      sendJSON(res, 200, { status: 'ok', platforms: status });
      return;
    }

    // AI聊天
    if (pathname === '/api/ai/chat' && req.method === 'POST') {
      const { UnifiedAIService } = require('./lib/ai_service');
      const body = await readJsonBody(req);

      if (!body.message) {
        sendJSON(res, 400, { status: 1, message: '缺少message参数' });
        return;
      }

      const aiService = new UnifiedAIService();

      try {
        const result = await aiService.chat(body.message, {
          mode: body.mode || 'smart',
          history: body.history || [],
          context: body.context || {}
        });
        sendJSON(res, 200, result);
      } catch (error) {
        console.error('[AI] 聊天错误:', error);
        sendJSON(res, 500, {
          status: 1,
          error: error.message,
          fallback: '抱歉，AI服务暂时不可用'
        });
      }
      return;
    }

    // 生图 / 改图（即梦 → 美图降级）
    if (pathname === '/api/creative/image' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mk = getMemberKey(req) || body.memberKey || '';
      const action = body.action === 'edit' ? 'edit' : 'generate';
      const kind = action === 'edit' ? 'imageEdit' : 'imageGen';
      if (!mk) {
        sendJSON(res, 401, { status: 1, message: '请先获取会员密钥：打开助手页自动分配，或传 X-Member-Key' });
        return;
      }
      const c = member.tryConsume(mk, kind);
      if (!c.ok) {
        sendJSON(res, 402, {
          status: 1,
          message: '额度或积分不足',
          code: 'PAYMENT_REQUIRED',
          detail: c,
        });
        return;
      }
      const result = creative.runImage({
        action,
        prompt: body.prompt || '',
        imageUrl: body.imageUrl || body.image || '',
        provider: body.provider || 'auto',
      });
      const parsed = parseCliCreative(result.raw || '');
      sendJSON(res, result.ok ? 200 : 500, {
        status: result.ok ? 0 : 1,
        message: result.ok ? 'ok' : result.error || 'creative_failed',
        data: {
          engine: result.engine,
          provider: result.provider,
          fallbackFrom: result.fallbackFrom,
          jimengError: result.jimengError,
          cli: parsed,
          consume: c,
        },
      });
      return;
    }

    // 视频能力预检（扣积分/配额）
    if (pathname === '/api/creative/video-reserve' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mk = getMemberKey(req) || body.memberKey || '';
      if (!mk) {
        sendJSON(res, 401, { status: 1, message: '缺少 X-Member-Key' });
        return;
      }
      const c = member.tryConsume(mk, 'videoGen');
      if (!c.ok) {
        sendJSON(res, 402, { status: 1, message: '视频额度不足', detail: c });
        return;
      }
      sendJSON(res, 200, { status: 0, message: 'reserved', data: { consume: c, user: member.publicUser(mk) } });
      return;
    }

    // 管理端：登录验证（账号密码从 .env 读取，不在前端硬编码）
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { email, password } = body;
      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        sendJSON(res, 503, { status: 1, message: '管理员账号未配置，请在 .env 中设置 ADMIN_EMAIL 和 ADMIN_PASSWORD' });
        return;
      }
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = makeToken(email);
        sendJSON(res, 200, { status: 0, token, name: '管理员', permissions: ['all'] });
      } else {
        sendJSON(res, 401, { status: 1, message: '账号或密码错误' });
      }
      return;
    }

    // 管理端：会员与积分
    if (pathname === '/api/admin/membership' && (req.method === 'POST' || req.method === 'GET')) {
      if (!(await adminOk(req))) {
        sendJSON(res, 403, { status: 1, message: '需要 x-admin-secret' });
        return;
      }
      if (req.method === 'GET') {
        const st = member.getState();
        sendJSON(res, 200, {
          status: 0,
          data: { config: st.config, userCount: Object.keys(st.users || {}).length, users: st.users },
        });
        return;
      }
      const body = await readJsonBody(req);
      const act = body.action || 'updateConfig';
      if (act === 'updateConfig') {
        member.updateConfig(body.config || body);
        sendJSON(res, 200, { status: 0, data: member.publicConfig() });
        return;
      }
      if (act === 'setUser') {
        const mk = body.memberKey;
        if (!mk) {
          sendJSON(res, 400, { status: 1, message: 'memberKey 必填' });
          return;
        }
        if (body.tierId) member.setTier(mk, body.tierId);
        if (body.pointsDelta != null) member.addPoints(mk, Number(body.pointsDelta));
        if (body.points != null) {
          const u = member.ensureUser(mk);
          u.points = Math.max(0, Number(body.points));
          member.persist();
        }
        sendJSON(res, 200, { status: 0, data: member.publicUser(mk) });
        return;
      }
      sendJSON(res, 400, { status: 1, message: 'unknown action' });
      return;
    }

    // 统一 OTA 查询 POST /api/ota/query  { type, ... }
    // 兼容旧前端：同时支持 /api/query 和 /api/ota/query
    if ((pathname === '/api/ota/query' || pathname === '/api/query') && (req.method === 'POST' || req.method === 'GET')) {
      let body = {};
      if (req.method === 'POST') {
        body = await readJsonBody(req);
      } else {
        body = query;
      }

      const mkOta = getMemberKey(req) || body.memberKey || '';
      if (mkOta) {
        const oc = member.tryConsume(mkOta, 'otaQuery');
        if (!oc.ok) {
          sendJSON(res, 402, {
            status: 1,
            message: 'OTA 查询次数或积分不足',
            code: 'OTA_QUOTA',
            detail: oc,
          });
          return;
        }
      }

      const type = body.type || query.type || 'hotel';
      const d = defaultDates();

      let result;
      switch (type) {
        case 'hotel': {
          const destName = body.destName || body.cityName || query.destName || '三亚';
          const keyWords = body.keyWords || body.hotelName || query.keyWords || '';
          const checkIn = body.checkIn || query.checkIn || d.checkIn;
          const checkOut = body.checkOut || query.checkOut || d.checkOut;
          result = await ota.searchHotels({ destName, keyWords, checkIn, checkOut });
          break;
        }
        case 'flight': {
          const fromCity = body.fromCity || body.from || query.fromCity || '北京';
          const toCity = body.toCity || body.to || query.toCity || '三亚';
          const date = body.date || query.date || d.checkIn;
          result = await ota.searchFlights({ fromCity, toCity, date });
          break;
        }
        case 'train': {
          const fromCity = body.fromCity || body.from || query.fromCity || '北京';
          const toCity = body.toCity || body.to || query.toCity || '上海';
          const date = body.date || query.date || d.checkIn;
          result = await ota.searchTrains({ fromCity, toCity, date });
          break;
        }
        case 'ticket': {
          const cityName = body.cityName || body.city_name || query.cityName || '三亚';
          const scenicName = body.scenicName || body.scenic_name || query.scenicName || '蜈支洲岛';
          result = await ota.searchTickets({ cityName, scenicName });
          break;
        }
        case 'cruise': {
          const departsDateBegin = body.departsDateBegin || query.departsDateBegin || d.checkIn;
          const departsDateEnd = body.departsDateEnd || query.departsDateEnd || d.checkOut;
          result = await ota.searchCruises({ departsDateBegin, departsDateEnd });
          break;
        }
        case 'holiday': {
          const destinationName = body.destinationName || body.destName || query.destinationName || '三亚';
          const departsDateBegin = body.departsDateBegin || query.departsDateBegin || d.checkIn;
          const departsDateEnd = body.departsDateEnd || query.departsDateEnd || d.checkOut;
          result = await ota.searchHolidays({ destinationName, departsDateBegin, departsDateEnd });
          break;
        }
        case 'trend': {
          const destName = body.destName || query.destName || '三亚';
          const checkIn = body.checkIn || query.checkIn || d.checkIn;
          const days = Number(body.days || query.days || 7);
          result = await ota.priceTrendHotel({ destName, checkIn, days });
          break;
        }
        default:
          sendJSON(res, 400, { status: 1, message: unknownType(type) });
          return;
      }

      sendJSON(res, 200, {
        status: 0,
        message: 'success',
        data: result,
        meta: {
          skill: 'ota-hotel-flight-query',
          feishuBaseUrl: feishu.getConfiguredBaseUrl(),
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 酒店 GET（兼容旧前端）
    if (pathname === '/api/hotel/search' && req.method === 'GET') {
      const destName = query.destName || '三亚';
      const keyWords = query.keyWords || query.hotelName || '';
      const checkIn = query.checkIn || defaultDates().checkIn;
      const checkOut = query.checkOut || defaultDates().checkOut;
      const data = await ota.searchHotels({ destName, keyWords, checkIn, checkOut });
      sendJSON(res, 200, {
        status: 0,
        message: 'success',
        data: {
          destName: data.destName,
          keyWords: data.keyWords,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          hotels: data.hotels,
        },
        meta: {
          total: data.hotels.length,
          tuniuCount: data.meta.tuniuCount,
          flyaiCount: data.meta.flyaiCount,
          tuniuSuccess: data.meta.tuniuSuccess,
          flyaiSuccess: data.meta.flyaiSuccess,
          skill: 'ota-hotel-flight-query',
          feishuBaseUrl: feishu.getConfiguredBaseUrl(),
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 检查飞书CLI状态
    if (pathname === '/api/feishu/cli-check' && req.method === 'POST') {
      try {
        const cliCheck = await feishuCli.checkFeishuCLI();
        sendJSON(res, 200, {
          status: cliCheck.installed ? 0 : 1,
          message: cliCheck.installed ? '飞书CLI已安装' : '飞书CLI未安装',
          data: cliCheck
        });
      } catch (error) {
        sendJSON(res, 500, {
          status: 1,
          message: '检查失败',
          data: { error: error.message }
        });
      }
      return;
    }

    // 飞书CLI同步 - 新的集成方式
    if (pathname === '/api/feishu/sync' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { tableName, tableDesc, records, toolType } = body;

        if (!tableName || !records || !records.length) {
          sendJSON(res, 400, { status: 1, message: 'tableName 和 records 不能为空' });
          return;
        }

        // 检查飞书CLI是否安装
        const cliCheck = await feishuCli.checkFeishuCLI();
        if (!cliCheck.installed) {
          sendJSON(res, 400, {
            status: 1,
            message: '飞书CLI未安装',
            data: { hint: '请运行: npm install -g @larksuite/cli' }
          });
          return;
        }

        // 创建表格
        const createResult = await feishuCli.createTable(tableName, tableDesc);
        if (!createResult.success) {
          sendJSON(res, 500, {
            status: 1,
            message: '创建表格失败',
            data: { error: createResult.error }
          });
          return;
        }

        // 将中文字段名的记录转换为飞书默认字段格式
        let defaultRecords;
        if (toolType === 'hotel') {
          defaultRecords = records.map(record => ({
            '文本': `${record['酒店名称'] || record.name || '未知'} | ${record['来源'] || record.src || ''} | ¥${record['价格'] || record.price || 0}`,
            '单选': record['星级'] || record.star ? `${record['星级'] || record.star}星级` : '未分类',
            '日期': record['入住日期'] || record.checkIn ? new Date(record['入住日期'] || record.checkIn).getTime() : Date.now()
          }));
        } else {
          defaultRecords = records.map(record => ({
            '文本': JSON.stringify(record),
            '日期': Date.now()
          }));
        }

        // 添加记录（使用新的API，需要appToken和tableId）
        const addResult = await feishuCli.addRecords(
          createResult.appToken,
          createResult.tableId,
          defaultRecords
        );

        if (!addResult.success) {
          sendJSON(res, 500, {
            status: 1,
            message: '添加记录失败',
            data: { error: addResult.error }
          });
          return;
        }

        sendJSON(res, 200, {
          status: 0,
          message: '同步成功',
          data: {
            tableName,
            tableUrl: createResult.url,
            appToken: createResult.appToken,
            tableId: createResult.tableId,
            recordCount: addResult.count || records.length,
            hint: `已成功创建表格 "${tableName}" 并添加 ${addResult.count || records.length} 条记录`,
            url: createResult.url
          }
        });
      } catch (error) {
        console.error('飞书同步错误:', error);
        sendJSON(res, 500, {
          status: 1,
          message: '同步失败',
          data: { error: error.message }
        });
      }
      return;
    }

    // 价格趋势分析
    if (pathname === '/api/ota/trend' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { toolType, dest, startDate, endDate } = body;

        if (!dest || !startDate || !endDate) {
          sendJSON(res, 400, { status: 1, message: '参数不完整' });
          return;
        }

        // 模拟价格趋势数据（实际应用中应该从数据库或API获取历史数据）
        const trend = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        if (daysDiff > 30) {
          sendJSON(res, 400, { status: 1, message: '日期范围不能超过30天' });
          return;
        }

        // 生成模拟数据
        let basePrice = toolType === 'hotel' ? 500 : toolType === 'flight' ? 800 : 100;
        for (let i = 0; i <= daysDiff; i++) {
          const currentDate = new Date(start);
          currentDate.setDate(currentDate.getDate() + i);

          // 模拟价格波动
          const randomFactor = 0.8 + Math.random() * 0.4; // 0.8-1.2的随机因子
          const weekendFactor = [0, 6].includes(currentDate.getDay()) ? 1.2 : 1.0;
          const price = Math.round(basePrice * randomFactor * weekendFactor);

          trend.push({
            date: currentDate.toISOString().slice(0, 10),
            price: price
          });
        }

        // 生成推荐建议
        const avgPrice = Math.round(trend.reduce((sum, item) => sum + item.price, 0) / trend.length);
        const minPriceItem = trend.reduce((min, item) => item.price < min.price ? item : min);
        const maxPriceItem = trend.reduce((max, item) => item.price > max.price ? item : max);

        const recommendations = [
          `平均价格为 ¥${avgPrice}，建议在 ¥${Math.round(avgPrice * 0.9)} 以下预订`,
          `最低价格出现在 ${minPriceItem.date}，为 ¥${minPriceItem.price}`,
          `避开 ${maxPriceItem.date} 等高价时段，可节省 ¥${maxPriceItem.price - minPriceItem.price}`,
          '提前3-7天预订通常能获得较好价格',
          '工作日价格通常比周末便宜10-20%'
        ];

        sendJSON(res, 200, {
          status: 0,
          message: '分析成功',
          data: {
            trend,
            recommendations,
            avgPrice,
            minPrice: minPriceItem.price,
            maxPrice: maxPriceItem.price
          }
        });
      } catch (error) {
        console.error('趋势分析错误:', error);
        sendJSON(res, 500, {
          status: 1,
          message: '分析失败',
          data: { error: error.message }
        });
      }
      return;
    }

    // 飞书自动同步（使用CLI自动创建表格并添加数据）
    if (pathname === '/api/feishu/auto-sync' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const kind = body.kind || 'hotel';
        const rows = body.rows || body.hotels || [];

        if (!rows.length) {
          sendJSON(res, 400, { status: 1, message: 'rows 不能为空' });
          return;
        }

        // 构建记录
        let records;
        let tableName = 'OTA查询结果';
        let meta = body.meta || {};

        if (kind === 'hotel') {
          records = feishuCli.buildHotelRecords(rows, meta);
          tableName = `${meta.dest || '酒店'}比价_${new Date().toISOString().slice(0, 10)}`;
        } else if (kind === 'flight') {
          records = feishuCli.buildFlightRecords(rows, meta);
          tableName = `${meta.fromCity || ''}至${meta.toCity || ''}机票`;
        } else if (kind === 'ticket') {
          records = feishuCli.buildTicketRecords(rows, meta);
          tableName = `${meta.dest || '景点'}门票`;
        } else if (kind === 'train') {
          records = feishuCli.buildTrainRecords(rows, meta);
          tableName = `${meta.fromCity || ''}至${meta.toCity || ''}火车票`;
        } else {
          records = feishu.buildGenericRecords(rows, body.typeLabel || 'OTA');
        }

        // 创建表格
        const tableResult = await feishuCli.createTable(tableName);

        if (!tableResult.success) {
          sendJSON(res, 500, {
            status: 1,
            message: '创建表格失败: ' + tableResult.error
          });
          return;
        }

        // 添加记录
        const addResult = await feishuCli.addRecords(
          tableResult.appToken,
          tableResult.tableId,
          records
        );

        sendJSON(res, 200, {
          status: 0,
          message: '自动同步成功',
          data: {
            tableUrl: tableResult.url,
            appToken: tableResult.appToken,
            tableId: tableResult.tableId,
            addedCount: addResult.count,
            totalCount: addResult.total,
            hint: `已创建表格"${tableName}"并添加${addResult.count}/${addResult.total}条记录，点击链接查看`
          },
        });
      } catch (err) {
        console.error('[飞书自动同步错误]', err);
        sendJSON(res, 500, { status: 1, message: err.message });
      }
      return;
    }

    // 飞书推送
    if (pathname === '/api/feishu/push' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const kind = body.kind || 'hotel';
      const rows = body.rows || body.hotels || [];
      if (!rows.length) {
        sendJSON(res, 400, { status: 1, message: 'rows 不能为空' });
        return;
      }
      let records;
      if (kind === 'hotel') {
        records = feishu.buildHotelQuoteRecords(rows, body.meta || {});
      } else {
        records = feishu.buildGenericRecords(rows, body.typeLabel || 'OTA');
      }
      const data = await feishu.batchCreateRecords(records);
      const baseUrl = feishu.getConfiguredBaseUrl();
      sendJSON(res, 200, {
        status: 0,
        message: 'success',
        data: {
          feishu: data,
          tableUrl: baseUrl,
          hint: baseUrl ? '已写入多维表格，请点击链接查看' : '请配置 FEISHU_BASE_URL 以生成直达链接',
        },
      });
      return;
    }

    // 兼容旧 GET
    if (pathname === '/api/feishu/write' && req.method === 'GET') {
      sendJSON(res, 200, {
        status: 0,
        message: '请使用 POST /api/feishu/push 推送数据',
        data: { doc: 'https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/batch_create' },
      });
      return;
    }

    // 静态
    const staticFile = pathname.replace(/^\//, '');
    if (pathname.startsWith('/api/')) {
      sendJSON(res, 404, { status: 1, message: 'API 不存在: ' + pathname });
      return;
    }
    if (staticFile && fs.existsSync(path.join(__dirname, staticFile))) {
      sendFile(res, staticFile, __dirname);
      return;
    }

    sendFile(res, 'index.html', __dirname);
  } catch (err) {
    console.error('[API]', err);
    sendJSON(res, 500, { status: 1, message: err.message || String(err) });
  }
});

function unknownType(t) {
  return `未知 type: ${t}`;
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🍅 番茄旅行 OTA API 已启动               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  http://${HOST}:${PORT}`);
  console.log('║  GET  /health');
  console.log('║  GET  /api/hotel/search');
  console.log('║  POST /api/ota/query  { type: hotel|flight|... }');
  console.log('║  POST /api/feishu/push');
  console.log('║  GET  /api/member/config   GET /api/member/me');
  console.log('║  GET  /api/ai/status');
  console.log('║  POST /api/ai/chat  { message, mode, history }');
  console.log('║  POST /api/creative/image  POST /api/creative/video-reserve');
  console.log('║  POST /api/admin/membership (x-admin-secret)');
  console.log('║  GET  /api/cms/config    CMS配置查询');
  console.log('║  POST /api/cms/{content|style|layout}  CMS内容更新');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
