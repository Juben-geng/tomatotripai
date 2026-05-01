/**
 * CMS内容管理
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CMS_FILE = path.join(DATA_DIR, 'cms.json');

function loadCms() {
  try {
    if (fs.existsSync(CMS_FILE)) {
      return JSON.parse(fs.readFileSync(CMS_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return { content: {}, style: {}, layout: {}, media: { images: [] } };
}

function saveCms(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CMS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function getAllConfig() {
  return loadCms();
}

function loadContent() {
  return loadCms().content || {};
}

function saveContent(data) {
  const store = loadCms();
  store.content = { ...store.content, ...data };
  saveCms(store);
}

function loadStyle() {
  return loadCms().style || {};
}

function saveStyle(data) {
  const store = loadCms();
  store.style = { ...store.style, ...data };
  saveCms(store);
}

function loadLayout() {
  return loadCms().layout || {};
}

function saveLayout(data) {
  const store = loadCms();
  store.layout = { ...store.layout, ...data };
  saveCms(store);
}

function loadMedia() {
  return loadCms().media || { images: [] };
}

function removeImage(imageId) {
  const store = loadCms();
  if (!store.media) store.media = { images: [] };
  const before = store.media.images.length;
  store.media.images = store.media.images.filter(img => img.id !== imageId);
  if (store.media.images.length < before) {
    saveCms(store);
    return true;
  }
  return false;
}

module.exports = { getAllConfig, loadContent, saveContent, loadStyle, saveStyle, loadLayout, saveLayout, loadMedia, removeImage };
