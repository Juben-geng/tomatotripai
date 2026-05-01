/**
 * 会员与积分管理
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'membership.json');

const DEFAULT_CONFIG = {
  monthly: {
    otaQuery: 100,
    imageGen: 30,
    imageEdit: 20,
    videoGen: 5,
  },
  points: {
    otaQuery: 2,
    imageGen: 18,
    imageEdit: 15,
    videoGen: 88,
  },
  tiers: [
    { id: 'free', name: '免费版', monthly: { otaQuery: 100, imageGen: 30, imageEdit: 20, videoGen: 5 } },
    { id: 'pro', name: '专业版', monthly: { otaQuery: 500, imageGen: 100, imageEdit: 50, videoGen: 20 } },
    { id: 'enterprise', name: '企业版', monthly: { otaQuery: 9999, imageGen: 9999, imageEdit: 9999, videoGen: 9999 } },
  ],
  rechargePackages: [
    { id: 'p100', name: '100积分', points: 100, price: 9.9 },
    { id: 'p500', name: '500积分', points: 500, price: 39.9 },
    { id: 'p2000', name: '2000积分', points: 2000, price: 129 },
  ],
};

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return { config: DEFAULT_CONFIG, users: {} };
}

function persist(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function ensureUser(mk) {
  const store = loadStore();
  if (!store.users[mk]) {
    store.users[mk] = {
      key: mk,
      tierId: 'free',
      points: 0,
      usage: {},
      history: [],
      created: Date.now(),
    };
    persist(store);
  }
  return store.users[mk];
}

function publicConfig() {
  const store = loadStore();
  return store.config || DEFAULT_CONFIG;
}

function publicUser(mk) {
  const user = ensureUser(mk);
  const config = publicConfig();
  const tier = (config.tiers || []).find(t => t.id === user.tierId) || config.tiers[0];
  return {
    key: mk,
    tierId: user.tierId,
    tierName: tier ? tier.name : '免费版',
    points: user.points || 0,
    usage: user.usage || {},
    config: config,
  };
}

function tryConsume(mk, kind) {
  const store = loadStore();
  const user = ensureUser(mk);
  const config = store.config || DEFAULT_CONFIG;
  const tier = (config.tiers || []).find(t => t.id === user.tierId) || config.tiers[0];
  const monthlyLimits = tier ? tier.monthly : config.monthly;

  // Check monthly quota
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (!user.usage) user.usage = {};
  if (!user.usage[currentMonth]) user.usage[currentMonth] = {};
  const monthUsage = user.usage[currentMonth];

  const used = monthUsage[kind] || 0;
  const limit = monthlyLimits[kind] || 0;

  if (used >= limit && user.points < (config.points[kind] || 0)) {
    return { ok: false, reason: 'monthly_quota_exceeded', used, limit, kind };
  }

  // Consume quota or points
  if (used < limit) {
    monthUsage[kind] = used + 1;
  } else {
    const cost = config.points[kind] || 0;
    if (user.points < cost) {
      return { ok: false, reason: 'insufficient_points', points: user.points, cost, kind };
    }
    user.points -= cost;
  }

  // Record history
  if (!user.history) user.history = [];
  user.history.push({ action: kind, timestamp: Date.now(), cost: config.points[kind] || 0 });
  if (user.history.length > 200) user.history = user.history.slice(-200);

  persist(store);
  return {
    ok: true,
    used: monthUsage[kind],
    limit,
    points: user.points,
    kind,
  };
}

function applyRechargePackage(mk, packageId) {
  const store = loadStore();
  const user = ensureUser(mk);
  const config = store.config || DEFAULT_CONFIG;
  const pkg = (config.rechargePackages || []).find(p => p.id === packageId);

  if (!pkg) return { ok: false, error: 'package_not_found' };

  user.points = (user.points || 0) + pkg.points;
  if (!user.history) user.history = [];
  user.history.push({ action: 'recharge', timestamp: Date.now(), packageId, points: pkg.points });

  persist(store);
  return { ok: true, points: user.points, package: pkg };
}

function getState() {
  return loadStore();
}

function updateConfig(newConfig) {
  const store = loadStore();
  store.config = { ...store.config, ...newConfig };
  persist(store);
}

function setTier(mk, tierId) {
  const store = loadStore();
  const user = ensureUser(mk);
  user.tierId = tierId;
  persist(store);
}

function addPoints(mk, delta) {
  const store = loadStore();
  const user = ensureUser(mk);
  user.points = Math.max(0, (user.points || 0) + delta);
  persist(store);
}

module.exports = {
  publicConfig,
  publicUser,
  ensureUser,
  tryConsume,
  applyRechargePackage,
  getState,
  updateConfig,
  setTier,
  addPoints,
  persist: () => persist(loadStore()),
};
