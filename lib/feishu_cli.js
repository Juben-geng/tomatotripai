/**
 * 飞书 CLI 集成
 */
const { execSync } = require('child_process');

async function checkFeishuCLI() {
  try {
    const out = execSync('lark --version 2>/dev/null || lark-cli --version 2>/dev/null', {
      timeout: 5000,
      encoding: 'utf8',
    });
    return { installed: true, version: out.trim() };
  } catch (e) {
    return { installed: false, error: '飞书CLI未安装，请运行: npm install -g @larksuite/cli' };
  }
}

async function createTable(tableName, tableDesc) {
  try {
    const cmd = `lark bitable create --name "${tableName}" ${tableDesc ? `--desc "${tableDesc}"` : ''} --json`;
    const out = execSync(cmd, { timeout: 30000, encoding: 'utf8' });
    const data = JSON.parse(out.trim());
    return { success: true, appToken: data.appToken, tableId: data.tableId, url: data.url };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function addRecords(appToken, tableId, records) {
  try {
    const cmd = `lark bitable record add --appToken "${appToken}" --tableId "${tableId}" --records '${JSON.stringify(records).replace(/'/g, "'\\''")}' --json`;
    const out = execSync(cmd, { timeout: 60000, encoding: 'utf8' });
    const data = JSON.parse(out.trim());
    return { success: true, count: data.count || records.length, total: records.length };
  } catch (e) {
    return { success: false, count: 0, total: records.length, error: e.message };
  }
}

function buildHotelRecords(rows, meta) {
  return rows.map(r => ({
    '酒店名称': r.name || r['酒店名称'] || '',
    '价格': String(r.price || r['价格'] || 0),
    '星级': String(r.star || r['星级'] || ''),
    '来源': r.source || r['来源'] || '',
    '目的地': meta.dest || meta.destName || '',
  }));
}

function buildFlightRecords(rows, meta) {
  return rows.map(r => ({
    '航班号': r.flightNo || '',
    '出发城市': r.fromCity || meta.fromCity || '',
    '到达城市': r.toCity || meta.toCity || '',
    '价格': String(r.price || 0),
  }));
}

function buildTicketRecords(rows, meta) {
  return rows.map(r => ({
    '景点名称': r.name || '',
    '价格': String(r.price || 0),
    '城市': meta.dest || '',
  }));
}

function buildTrainRecords(rows, meta) {
  return rows.map(r => ({
    '车次': r.trainNo || '',
    '出发城市': r.fromCity || meta.fromCity || '',
    '到达城市': r.toCity || meta.toCity || '',
    '价格': String(r.price || 0),
  }));
}

module.exports = { checkFeishuCLI, createTable, addRecords, buildHotelRecords, buildFlightRecords, buildTicketRecords, buildTrainRecords };
