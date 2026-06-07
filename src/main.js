import './style.css'
import { getCultureContent } from './culture-data.js'

/* ============================================================
   寻迹华夏 — AI 动态文化地图
   All state and DOM queries
   ============================================================ */

const API_ENDPOINT = '/api/culture';

const tooltip = document.getElementById('tooltip');
const panelProvince = document.getElementById('panel-province');
const idleState = document.getElementById('idle-state');
const loadingState = document.getElementById('loading-state');
const generatedContent = document.getElementById('generated-content');
const generatedText = document.getElementById('generated-text');

let activeProvince = null;
let isStreaming = false;
let abortController = null;

/* ============================================================
   Client-side Cache — 避免重复调用 API
   key = province name, value = markdown string
   ============================================================ */
const contentCache = new Map();

/* ============================================================
   Province identification by bounding box center coordinates.
   Each entry maps to a path in public/china.svg (fill="#eee").
   The SVG viewBox is 578×344; X → East, Y → South.
   Coordinates were extracted from the actual path geometry.
   ============================================================ */
const PROVINCE_CENTERS = [
  { name: "北京",     cx: 354.4, cy: 115.5 },
  { name: "天津",     cx: 359.4, cy: 121.4 },
  { name: "河北",     cx: 355.5, cy: 121.4 },
  { name: "山西",     cx: 332.6, cy: 133.0 },
  { name: "内蒙古",   cx: 328.4, cy: 73.6  },
  { name: "辽宁",     cx: 385.9, cy: 109.2 },
  { name: "吉林",     cx: 408.3, cy: 91.0  },
  { name: "黑龙江",   cx: 417.2, cy: 51.3  },
  { name: "上海",     cx: 381.4, cy: 175.1 },
  { name: "江苏",     cx: 369.0, cy: 164.4 },
  { name: "浙江",     cx: 375.7, cy: 188.2 },
  { name: "安徽",     cx: 358.7, cy: 170.2 },
  { name: "福建",     cx: 363.5, cy: 207.7 },
  { name: "江西",     cx: 352.1, cy: 199.6 },
  { name: "山东",     cx: 366.8, cy: 141.9 },
  { name: "河南",     cx: 338.5, cy: 158.3 },
  { name: "湖北",     cx: 331.8, cy: 175.8 },
  { name: "湖南",     cx: 327.8, cy: 199.0 },
  { name: "广东",     cx: 338.1, cy: 225.9 },
  { name: "广西",     cx: 310.4, cy: 220.9 },
  { name: "海南",     cx: 336.9, cy: 286.7 },
  { name: "重庆",     cx: 307.5, cy: 181.9 },
  { name: "四川",     cx: 281.7, cy: 181.5 },
  { name: "贵州",     cx: 301.4, cy: 201.8 },
  { name: "云南",     cx: 275.9, cy: 211.9 },
  { name: "西藏",     cx: 205.4, cy: 171.9 },
  { name: "陕西",     cx: 310.9, cy: 146.3 },
  { name: "甘肃",     cx: 268.7, cy: 132.0 },
  { name: "青海",     cx: 245.7, cy: 148.0 },
  { name: "宁夏",     cx: 298.0, cy: 135.6 },
  { name: "新疆",     cx: 184.9, cy: 101.7 },
  { name: "台湾",     cx: 384.2, cy: 219.8 },
  { name: "香港",     cx: 341.8, cy: 228.9 },
  { name: "澳门",     cx: 338.8, cy: 230.1 },
  { name: "南海诸岛", cx: 349.2, cy: 275.0 },
];

/**
 * Compute the bounding-box center of a <path> element's "d" attribute.
 */
function getPathCenter(d) {
  const numRegex = /([\d.]+),([\d.]+)/g;
  let m;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  while ((m = numRegex.exec(d)) !== null) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return null;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * Match a path's bounding-box center to the closest known province.
 */
function identifyProvince(d) {
  const center = getPathCenter(d);
  if (!center) return null;

  let best = null;
  let bestDist = Infinity;
  for (const p of PROVINCE_CENTERS) {
    const dist = Math.hypot(center.cx - p.cx, center.cy - p.cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  // Only accept if reasonably close (< 5 units in SVG coordinates)
  return bestDist < 5 ? best.name : null;
}

/* ============================================================
   Tooltip — follows cursor
   ============================================================ */
document.addEventListener('mousemove', (e) => {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top = (e.clientY - 8) + 'px';
});

/* ============================================================
   UI State Machine
   ============================================================ */
function setUIState(state) {
  idleState.style.display = state === 'idle' ? 'flex' : 'none';
  loadingState.style.display = state === 'loading' ? 'flex' : 'none';

  if (state === 'content') {
    generatedContent.style.display = 'block';
    requestAnimationFrame(() => generatedContent.classList.add('visible'));
  } else {
    generatedContent.classList.remove('visible');
    generatedContent.style.display = 'none';
    generatedText.innerHTML = '';
  }
}

/* ============================================================
   Map Event Binding
   ============================================================ */
function initMap() {
  const map = document.getElementById('china-map');
  const placeholder = document.getElementById('map-placeholder');
  if (!map || !placeholder) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Ensure SVG responsiveness
  if (!map.getAttribute('viewBox')) {
    const w = map.getAttribute('width') || 578;
    const h = map.getAttribute('height') || 344;
    map.setAttribute('viewBox', `0 0 ${w} ${h}`);
    map.removeAttribute('width');
    map.removeAttribute('height');
    map.setAttribute('style', 'width: 100%; height: 100%;');
  }

  // --- Create overlay group for hover/active highlights ---
  // This group sits on top of all province paths in the SVG tree,
  // so its children render above everything else.
  // pointer-events:none ensures mouse events pass through to the real paths.
  const overlayGroup = document.createElementNS(SVG_NS, 'g');
  overlayGroup.setAttribute('id', 'highlight-overlay');
  overlayGroup.setAttribute('pointer-events', 'none');
  map.appendChild(overlayGroup);

  // Reusable overlay <path> for hover highlight
  const hoverOverlay = document.createElementNS(SVG_NS, 'path');
  hoverOverlay.setAttribute('pointer-events', 'none');
  hoverOverlay.classList.add('hover-overlay');
  hoverOverlay.style.display = 'none';
  overlayGroup.appendChild(hoverOverlay);

  // Reusable overlay <path> for active (clicked) highlight
  const activeOverlay = document.createElementNS(SVG_NS, 'path');
  activeOverlay.setAttribute('pointer-events', 'none');
  activeOverlay.classList.add('active-overlay');
  activeOverlay.style.display = 'none';
  overlayGroup.appendChild(activeOverlay);

  // --- Zoom & Pan Logic ---
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;

  map.style.transformOrigin = '0 0';
  map.style.transition = 'transform 0.1s ease-out'; // Smooth wheel zoom
  
  function constrainTranslation(tx, ty, s) {
    const containerW = placeholder.clientWidth;
    const containerH = placeholder.clientHeight;

    const mapW = containerW * s;
    const mapH = containerH * s;

    // Constrain so at least 30% of the map remains visible in the viewport
    const minX = containerW * 0.3 - mapW;
    const maxX = containerW * 0.7;
    const minY = containerH * 0.3 - mapH;
    const maxY = containerH * 0.7;

    return {
      x: Math.max(minX, Math.min(maxX, tx)),
      y: Math.max(minY, Math.min(maxY, ty))
    };
  }

  function updateTransform() {
    const bounded = constrainTranslation(translateX, translateY, scale);
    translateX = bounded.x;
    translateY = bounded.y;
    map.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  placeholder.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 0.15;
    const delta = e.deltaY < 0 ? (1 + zoomFactor) : (1 - zoomFactor);
    let newScale = scale * delta;
    newScale = Math.max(0.5, Math.min(newScale, 10)); // Min and max zoom constraints

    const rect = placeholder.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    translateX = mouseX - (mouseX - translateX) * (newScale / scale);
    translateY = mouseY - (mouseY - translateY) * (newScale / scale);
    scale = newScale;

    updateTransform();
  }, { passive: false });

  placeholder.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left mouse button
    isDragging = true;
    hasDragged = false;
    map.style.transition = 'none'; // Disable transition during drag for immediate response
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    placeholder.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newTranslateX = e.clientX - startX;
    const newTranslateY = e.clientY - startY;
    if (Math.abs(newTranslateX - translateX) > 3 || Math.abs(newTranslateY - translateY) > 3) {
      hasDragged = true;
    }
    translateX = newTranslateX;
    translateY = newTranslateY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      map.style.transition = 'transform 0.1s ease-out';
      placeholder.style.cursor = 'default';
    }
  });

  // --- Identify and tag province paths ---
  const paths = map.querySelectorAll('path[fill="#eee"]');
  
  paths.forEach((path) => {
    const d = path.getAttribute('d');
    if (!d) return;

    const provinceName = identifyProvince(d);
    if (!provinceName) return; // Skip unidentified paths (e.g. decorative)

    // Inject data-name for reliable identification
    path.setAttribute('data-name', provinceName);

    path.addEventListener('mouseenter', () => {
      tooltip.textContent = provinceName;
      tooltip.classList.add('visible');

      // Show hover overlay — copy the path geometry and render on top
      hoverOverlay.setAttribute('d', d);
      hoverOverlay.style.display = '';
    });

    path.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
      hoverOverlay.style.display = 'none';
    });

    path.addEventListener('click', () => {
      if (isStreaming || hasDragged) return;

      // Clear previous active states from original paths
      map.querySelectorAll('path.active').forEach(p => p.classList.remove('active'));

      // Mark current path as active
      path.classList.add('active');

      // Show active overlay — copy geometry and render on top
      activeOverlay.setAttribute('d', d);
      activeOverlay.style.display = '';

      // Update right detail panel
      panelProvince.textContent = provinceName;
      setUIState('loading');

      // Abort previous generation if any
      if (abortController) {
        abortController.abort();
      }

      activeProvince = provinceName;
      loadProvinceContent(provinceName);
    });
  });
}

/* ============================================================
   Content Loading — SSE + Typewriter Fallback
   ============================================================ */
async function loadProvinceContent(province) {
  isStreaming = true;
  abortController = new AbortController();

  // ---- 客户端缓存命中：直接用打字机效果展示 ----
  if (contentCache.has(province)) {
    setUIState('content');
    const cachedMarkdown = contentCache.get(province);
    generatedText.innerHTML = parseMarkdown(cachedMarkdown);
    // 添加淡入效果
    generatedText.style.opacity = '0';
    requestAnimationFrame(() => {
      generatedText.style.transition = 'opacity 0.4s ease-in';
      generatedText.style.opacity = '1';
    });
    isStreaming = false;
    return;
  }

  // ---- 未命中缓存：调用后端 API ----
  try {
    await streamFromAPI(province, generatedText, abortController.signal);
  } catch (err) {
    if (err.name === 'AbortError') {
      isStreaming = false;
      return;
    }
    console.warn('后端 API 连结失败，进入本地数据降级:', err.message);
    
    // Fallback to local data with custom typewriter rendering
    setUIState('content');
    const data = getCultureContent(province);
    panelProvince.textContent = data.title;
    streamContent(generatedText, data.content);
  }
}

/* ============================================================
   SSE Streaming
   ============================================================ */
async function streamFromAPI(province, container, signal) {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: province }),
    signal: signal
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  setUIState('content');
  container.innerHTML = '';

  const cursor = document.createElement('span');
  cursor.className = 'ai-cursor';
  container.appendChild(cursor);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedMarkdown = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        cursor.remove();
        isStreaming = false;
        // 缓存到客户端，下次点击直接展示
        if (accumulatedMarkdown.trim()) {
          contentCache.set(province, accumulatedMarkdown);
        }
        return;
      }

      try {
        const json = JSON.parse(data);
        const chunk = json?.choices?.[0]?.delta?.content ?? '';
        if (chunk) {
          accumulatedMarkdown += chunk;
          container.innerHTML = parseMarkdown(accumulatedMarkdown);
          container.appendChild(cursor);
          // Auto scroll parent panel container
          const bodyEl = document.getElementById('panel-body');
          if (bodyEl) {
            bodyEl.scrollTop = bodyEl.scrollHeight;
          }
        }
      } catch (e) {
        // Skip invalid JSON chunks
      }
    }
  }

  cursor.remove();
  isStreaming = false;
  // 兜底缓存（流结束但未收到 [DONE] 信号时）
  if (accumulatedMarkdown.trim() && !contentCache.has(province)) {
    contentCache.set(province, accumulatedMarkdown);
  }
}

/* ============================================================
   Typewriter Engine (Local Fallback)
   ============================================================ */
function streamContent(container, rawText) {
  container.innerHTML = '';
  const html = parseMarkdown(rawText);

  // Read clean full HTML string
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const fullText = tempDiv.innerHTML;

  let index = 0;
  const speed = 12; // ms per char

  const cursor = document.createElement('span');
  cursor.className = 'ai-cursor';

  const bodyEl = document.getElementById('panel-body');

  function typeNext() {
    if (index >= fullText.length) {
      cursor.remove();
      isStreaming = false;
      return;
    }

    const char = fullText[index];

    // Jump past HTML tags instantly
    if (char === '<') {
      const tagEnd = fullText.indexOf('>', index);
      if (tagEnd !== -1) {
        container.innerHTML = fullText.substring(0, tagEnd + 1);
        index = tagEnd + 1;
        container.appendChild(cursor);
        requestAnimationFrame(typeNext);
        return;
      }
    }

    index++;
    container.innerHTML = fullText.substring(0, index);
    container.appendChild(cursor);

    if (bodyEl) {
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    let delay = speed;
    if ('。！？，；：'.includes(char)) delay = speed * 6;
    else if ('、'.includes(char)) delay = speed * 3;
    
    setTimeout(typeNext, delay);
  }

  requestAnimationFrame(typeNext);
}

/* ============================================================
   Simple Markdown Parser
   ============================================================ */
function parseMarkdown(text) {
  return text
    .trim()
    .split('\n')
    .map(line => {
      line = line.trim();
      if (!line) return '';
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith('**') && line.endsWith('**')) return `<p><strong>${line.slice(2, -2)}</strong></p>`;
      
      // Inline formatting
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
      return `<p>${line}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

/* ============================================================
   Load SVG Map
   ============================================================ */
async function loadMap() {
  try {
    const res = await fetch('/china.svg');
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const svgText = await res.text();
    const placeholder = document.getElementById('map-placeholder');

    placeholder.innerHTML = svgText;
    const svg = placeholder.querySelector('svg');
    if (!svg) throw new Error('No SVG element found');

    svg.id = 'china-map';
    svg.setAttribute('aria-hidden', 'true');

    initMap();
  } catch (e) {
    console.warn('华夏地图加载失败:', e);
  }
}

// Start
loadMap();
