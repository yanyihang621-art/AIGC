// ── 寻迹华夏 · main.js ──────────────────────────────────────────
// Handles: SVG map interaction, tooltip, SSE streaming, UI state
 
// ── Config ───────────────────────────────────────────────────────
const API_ENDPOINT = '/api/culture'; // 后端接口地址，联调时修改
 
// Province display names (id → 中文名)
// SVG path 的 id 需与此对应，例如 id="beijing"
const PROVINCE_NAMES = {
  beijing:        '北京',  tianjin:   '天津',  hebei:    '河北',
  shanxi:         '山西',  neimenggu: '内蒙古', liaoning: '辽宁',
  jilin:          '吉林',  heilongjiang: '黑龙江', shanghai: '上海',
  jiangsu:        '江苏',  zhejiang:  '浙江',  anhui:    '安徽',
  fujian:         '福建',  jiangxi:   '江西',  shandong: '山东',
  henan:          '河南',  hubei:     '湖北',  hunan:    '湖南',
  guangdong:      '广东',  guangxi:   '广西',  hainan:   '海南',
  chongqing:      '重庆',  sichuan:   '四川',  guizhou:  '贵州',
  yunnan:         '云南',  xizang:    '西藏',  shaanxi:  '陕西',
  gansu:          '甘肃',  qinghai:   '青海',  ningxia:  '宁夏',
  xinjiang:       '新疆',  taiwan:    '台湾',  hongkong: '香港',
  macao:          '澳门',
};
 
// ── DOM refs ─────────────────────────────────────────────────────
const tooltip         = document.getElementById('tooltip');
const panelProvince   = document.getElementById('panel-province');
const idleState       = document.getElementById('idle-state');
const loadingState    = document.getElementById('loading-state');
const generatedContent = document.getElementById('generated-content');
const generatedText   = document.getElementById('generated-text');
 
// ── State ─────────────────────────────────────────────────────────
let activeProvince = null;
let abortController = null;
 
// ── Tooltip ───────────────────────────────────────────────────────
document.addEventListener('mousemove', (e) => {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top  = (e.clientY - 8)  + 'px';
});
 
// ── Map interaction ───────────────────────────────────────────────
// Called after SVG is injected into the DOM
function initMap() {
  const map = document.getElementById('china-map');
  if (!map) return;
 
  const paths = map.querySelectorAll('path[id]');
 
  paths.forEach(path => {
    const id   = path.id;
    const name = PROVINCE_NAMES[id] || id;
 
    // Hover: show tooltip
    path.addEventListener('mouseenter', () => {
      tooltip.textContent = name;
      tooltip.classList.add('visible');
    });
 
    path.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
 
    // Click: trigger content generation
    path.addEventListener('click', () => {
      if (activeProvince === id) return;
      selectProvince(id, name, path);
    });
  });
}
 
function selectProvince(id, name, pathEl) {
  // Update active state on SVG
  document.querySelectorAll('#china-map path.active')
    .forEach(p => p.classList.remove('active'));
  pathEl.classList.add('active');
 
  activeProvince = id;
 
  // Update header
  panelProvince.textContent = name;
 
  // Cancel any in-flight request
  if (abortController) abortController.abort();
 
  // Show loading
  setUIState('loading');
 
  // Fetch via SSE
  fetchCulture(name);
}
 
// ── UI State machine ──────────────────────────────────────────────
// state: 'idle' | 'loading' | 'content'
function setUIState(state) {
  idleState.style.display       = state === 'idle'    ? 'flex'  : 'none';
  loadingState.style.display    = state === 'loading' ? 'flex'  : 'none';
 
  if (state === 'content') {
    generatedContent.style.display = 'block';
    // Trigger fade-in on next frame
    requestAnimationFrame(() => generatedContent.classList.add('visible'));
  } else {
    generatedContent.classList.remove('visible');
    generatedContent.style.display = 'none';
    generatedText.innerHTML = '';
  }
}
 
// ── SSE Streaming ─────────────────────────────────────────────────
async function fetchCulture(provinceName) {
  abortController = new AbortController();
 
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: provinceName }),
      signal: abortController.signal,
    });
 
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
 
    setUIState('content');
 
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
 
    // Add blinking cursor
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    generatedText.appendChild(cursor);
 
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
 
      buffer += decoder.decode(value, { stream: true });
 
      // Parse SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer
 
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
 
        try {
          const json = JSON.parse(data);
          // DeepSeek SSE format: delta.content
          const chunk = json?.choices?.[0]?.delta?.content ?? '';
          if (chunk) appendChunk(chunk, cursor);
        } catch {
          // non-JSON data line, skip
        }
      }
    }
 
    // Remove cursor when done
    cursor.remove();
 
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Fetch error:', err);
    setUIState('idle');
  }
}
 
function appendChunk(text, cursor) {
  // Insert text node before cursor
  const node = document.createTextNode(text);
  generatedText.insertBefore(node, cursor);
}
 
// ── SVG Map loader ────────────────────────────────────────────────
// Fetches china.svg and injects into #map-placeholder
async function loadMap() {
  try {
    const res = await fetch('/china.svg');
    if (!res.ok) return; // SVG not found, placeholder stays visible
 
    const svgText = await res.text();
    const placeholder = document.getElementById('map-placeholder');
 
    // Parse & inject
    const parser = new DOMParser();
    const doc    = parser.parseFromString(svgText, 'image/svg+xml');
    const svg    = doc.querySelector('svg');
    if (!svg) return;
 
    svg.id = 'china-map';
    svg.setAttribute('aria-hidden', 'true');
 
    placeholder.innerHTML = '';
    placeholder.appendChild(svg);
 
    initMap();
  } catch (e) {
    // SVG load failed, placeholder stays
  }
}
 
// ── Boot ──────────────────────────────────────────────────────────
loadMap();
 
