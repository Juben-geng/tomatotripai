/**
 * 飞书 OpenAPI 集成
 */
const https = require('https');

function getConfiguredBaseUrl() {
  const token = process.env.FEISHU_BASE_TOKEN;
  if (!token) return '';
  return `https://bytedance.feishu.cn/base/${token}`;
}

function buildHotelQuoteRecords(rows, meta) {
  return rows.map(r => ({
    fields: {
      '酒店名称': r.name || r['酒店名称'] || '',
      '价格': r.price || r['价格'] || 0,
      '星级': r.star || r['星级'] || '',
      '来源': r.source || r['来源'] || meta.source || '',
      '入住日期': meta.checkIn || '',
      '离店日期': meta.checkOut || '',
    },
  }));
}

function buildGenericRecords(rows, typeLabel) {
  return rows.map(r => ({
    fields: { '类型': typeLabel || 'OTA', '数据': JSON.stringify(r), '时间': new Date().toISOString() },
  }));
}

async function batchCreateRecords(records) {
  const baseUrl = getConfiguredBaseUrl();
  if (!baseUrl) return { status: 'no_base_configured', count: records.length };
  // Stub: 实际需要飞书API调用
  return { status: 'ok', count: records.length, hint: '飞书API调用需要在生产环境配置' };
}

module.exports = { getConfiguredBaseUrl, buildHotelQuoteRecords, buildGenericRecords, batchCreateRecords };
