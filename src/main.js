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

// Initial 35-path index mapping from public/china.svg
// We will verify and adjust this sequence if needed
const PROVINCES = [
  "河北",       // 0
  "北京",       // 1
  "天津",       // 2
  "山西",       // 3
  "内蒙古",     // 4
  "辽宁",       // 5
  "吉林",       // 6
  "黑龙江",     // 7
  "台湾",       // 8
  "浙江",       // 9
  "上海",       // 10
  "江西",       // 11
  "福建",       // 12
  "湖北",       // 13
  "湖南",       // 14
  "江苏",       // 15
  "安徽",       // 16
  "山东",       // 17
  "河南",       // 18
  "广东",       // 19
  "海南",       // 20
  "广西",       // 21
  "四川",       // 22
  "贵州",       // 23
  "云南",       // 24
  "西藏",       // 25
  "陕西",       // 26
  "甘肃",       // 27
  "青海",       // 28
  "宁夏",       // 29
  "新疆",       // 30
  "钓鱼岛",     // 31
  "香港",       // 32
  "澳门",       // 33
  "南海诸岛"    // 34
];

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
  if (!map) return;

  // Ensure SVG responsiveness
  if (!map.getAttribute('viewBox')) {
    const w = map.getAttribute('width') || 578;
    const h = map.getAttribute('height') || 344;
    map.setAttribute('viewBox', `0 0 ${w} ${h}`);
    map.removeAttribute('width');
    map.removeAttribute('height');
    map.style.width = '100%';
    map.style.height = '100%';
  }

  // Select all province paths in SVG
  const paths = map.querySelectorAll('path');

  paths.forEach((path, index) => {
    // Determine corresponding province name (fallback to path index if out of bounds)
    const provinceName = PROVINCES[index] || `省份 ${index + 1}`;

    path.addEventListener('mouseenter', () => {
      tooltip.textContent = `${provinceName} (Index: ${index})`;
      tooltip.classList.add('visible');
    });

    path.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });

    path.addEventListener('click', () => {
      if (isStreaming) return;

      // Clear previous active states
      map.querySelectorAll('path.active').forEach(p => p.classList.remove('active'));

      // Highlight current path
      path.classList.add('active');

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

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) throw new Error('No SVG element found');

    svg.id = 'china-map';
    svg.setAttribute('aria-hidden', 'true');

    placeholder.innerHTML = '';
    placeholder.appendChild(svg);

    initMap();
  } catch (e) {
    console.warn('华夏地图加载失败:', e);
  }
}

// Start
loadMap();
