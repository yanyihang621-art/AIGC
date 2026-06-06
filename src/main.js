// ── 寻迹华夏 · main.js ──────────────────────────────────────────

const API_ENDPOINT = '/api/culture';

const tooltip         = document.getElementById('tooltip');
const panelProvince   = document.getElementById('panel-province');
const idleState       = document.getElementById('idle-state');
const loadingState    = document.getElementById('loading-state');
const generatedContent = document.getElementById('generated-content');
const generatedText   = document.getElementById('generated-text');

let abortController = null;

// ── Tooltip 跟随鼠标 ──────────────────────────────────────────────
document.addEventListener('mousemove', (e) => {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top  = (e.clientY - 8)  + 'px';
});

// ── UI 状态机 ─────────────────────────────────────────────────────
function setUIState(state) {
  idleState.style.display       = state === 'idle'    ? 'flex'  : 'none';
  loadingState.style.display    = state === 'loading' ? 'flex'  : 'none';

  if (state === 'content') {
    generatedContent.style.display = 'block';
    requestAnimationFrame(() => generatedContent.classList.add('visible'));
  } else {
    generatedContent.classList.remove('visible');
    generatedContent.style.display = 'none';
    generatedText.innerHTML = '';
  }
}

// ── 地图初始化 ────────────────────────────────────────────────────
function initMap() {
  const map = document.getElementById('china-map');
  if (!map) return;

  // 给 SVG 加上 viewBox 使其自适应
  if (!map.getAttribute('viewBox')) {
    const w = map.getAttribute('width')  || 578;
    const h = map.getAttribute('height') || 344;
    map.setAttribute('viewBox', `0 0 ${w} ${h}`);
    map.removeAttribute('width');
    map.removeAttribute('height');
    map.style.width  = '100%';
    map.style.height = '100%';
  }

  // 选取省份 path（有 fill 颜色、不是虚线边界的）
  const paths = map.querySelectorAll('path[fill="#eee"]');

  paths.forEach((path, index) => {
    path.style.cursor     = 'pointer';
    path.style.transition = 'fill 0.45s cubic-bezier(0.16, 1, 0.3, 1)';

    path.addEventListener('mouseenter', () => {
      if (!path.classList.contains('active')) {
        path.style.fill = 'oklch(0.450 0.086 230 / 0.18)';
      }
      tooltip.textContent = `省份 ${index + 1}`;
      tooltip.classList.add('visible');
    });

    path.addEventListener('mouseleave', () => {
      if (!path.classList.contains('active')) {
        path.style.fill = '';
      }
      tooltip.classList.remove('visible');
    });

    path.addEventListener('click', () => {
      // 清除上一个高亮
      map.querySelectorAll('path.active').forEach(p => {
        p.classList.remove('active');
        p.style.fill = '';
      });

      // 高亮当前
      path.classList.add('active');
      path.style.fill = 'oklch(0.450 0.086 230 / 0.28)';

      // 更新右侧面板
      panelProvince.textContent = `省份 ${index + 1}`;
      setUIState('loading');

      // 取消上一次请求
      if (abortController) abortController.abort();

      // 发起 SSE 请求（后端接好后替换省份名）
      fetchCulture(`省份${index + 1}`);
    });
  });
}

// ── SSE 流式请求 ──────────────────────────────────────────────────
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

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    generatedText.appendChild(cursor);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;

        try {
          const json  = JSON.parse(data);
          const chunk = json?.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            const node = document.createTextNode(chunk);
            generatedText.insertBefore(node, cursor);
          }
        } catch {
          // 非 JSON，跳过
        }
      }
    }

    cursor.remove();

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('请求失败:', err);
    // 后端未就绪时回到 idle
    setUIState('idle');
  }
}

// ── 加载 SVG 地图 ─────────────────────────────────────────────────
async function loadMap() {
  try {
    const res = await fetch('/china.svg');
    if (!res.ok) return;

    const svgText = await res.text();
    const placeholder = document.getElementById('map-placeholder');

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
    console.warn('地图加载失败:', e);
  }
}

// ── 启动 ──────────────────────────────────────────────────────────
loadMap();
 
