import './style.css'
import { getChinaMapSVG } from './china-map.js'
import { getCultureContent } from './culture-data.js'

/* ============================================================
   寻迹华夏 — AI 动态文化地图
   Map-driven interactive cultural narrative website
   ============================================================ */

document.querySelector('#app').innerHTML = `
  <!-- Left: Map Region -->
  <div class="map-region">
    <div class="map-header">
      <span class="site-title">寻迹华夏</span>
      <span class="site-subtitle">AI 动态文化地图</span>
    </div>
    <div class="map-container" id="map-container">
      ${getChinaMapSVG()}
    </div>
  </div>

  <!-- Right: Detail Region -->
  <div class="detail-region" id="detail-region">
    <!-- Placeholder state -->
    <div class="detail-placeholder" id="detail-placeholder">
      <div class="placeholder-icon">迹</div>
      <p class="placeholder-text">点击地图上的省份，探索华夏文化的印迹</p>
    </div>

    <!-- Active content state (hidden initially) -->
    <div id="detail-active" style="display:none;flex-direction:column;height:100%;">
      <div class="detail-header">
        <h2 id="detail-title"></h2>
        <div class="province-label" id="province-label"></div>
      </div>
      <div class="detail-body" id="detail-body">
        <div class="ai-content" id="ai-content"></div>
      </div>
      <div class="detail-footer">
        <div class="seal" aria-hidden="true">迹</div>
        <span class="powered-by">由 AI 动态生成</span>
      </div>
    </div>
  </div>

  <!-- Tooltip -->
  <div class="map-tooltip" id="map-tooltip"></div>
`

/* ============================================================
   State
   ============================================================ */
let activeProvince = null
let isStreaming = false

/* ============================================================
   Tooltip — cursor-following province name
   ============================================================ */
const tooltip = document.getElementById('map-tooltip')
const mapContainer = document.getElementById('map-container')

mapContainer.addEventListener('mousemove', (e) => {
  const path = e.target.closest('path[data-name]')
  if (path) {
    tooltip.textContent = path.dataset.name
    tooltip.classList.add('visible')
    tooltip.style.left = e.clientX + 14 + 'px'
    tooltip.style.top = e.clientY - 10 + 'px'
  } else {
    tooltip.classList.remove('visible')
  }
})

mapContainer.addEventListener('mouseleave', () => {
  tooltip.classList.remove('visible')
})

/* ============================================================
   Province Click — trigger content loading
   ============================================================ */
mapContainer.addEventListener('click', (e) => {
  const path = e.target.closest('path[data-name]')
  if (!path || isStreaming) return

  const province = path.dataset.name

  // Update active state on map
  document.querySelectorAll('#china-map path.active').forEach(p => p.classList.remove('active'))
  path.classList.add('active')

  // Load content
  if (province !== activeProvince) {
    activeProvince = province
    loadProvinceContent(province)
  }
})

/* ============================================================
   Content Loading — real SSE streaming with local fallback
   ============================================================ */
async function loadProvinceContent(province) {
  const placeholder = document.getElementById('detail-placeholder')
  const active = document.getElementById('detail-active')
  const titleEl = document.getElementById('detail-title')
  const labelEl = document.getElementById('province-label')
  const contentEl = document.getElementById('ai-content')
  const bodyEl = document.getElementById('detail-body')

  // Show active panel
  placeholder.style.display = 'none'
  active.style.display = 'flex'

  // Set header
  titleEl.textContent = province + '风物'
  labelEl.textContent = province + ' · 文化概览'

  // Clear and show loading
  contentEl.innerHTML = ''
  contentEl.classList.remove('visible')
  bodyEl.scrollTop = 0

  contentEl.innerHTML = `
    <div class="loading-indicator" id="loading-indicator">
      <div class="loading-dots">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
      <span class="loading-text">正在生成文化叙事…</span>
    </div>
  `
  contentEl.classList.add('visible')
  isStreaming = true

  // Try real API first, fallback to local data
  try {
    await streamFromAPI(province, contentEl, bodyEl)
  } catch (err) {
    console.warn('API 不可用，使用本地数据:', err.message)
    const data = getCultureContent(province)
    titleEl.textContent = data.title
    streamContent(contentEl, data.content, bodyEl)
  }
}

/* ============================================================
   SSE Streaming — fetch from /api/culture
   ============================================================ */
async function streamFromAPI(province, container, scrollContainer) {
  const response = await fetch('/api/culture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: province }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  // Clear loading indicator
  container.innerHTML = ''

  // Add blinking cursor
  const cursor = document.createElement('span')
  cursor.className = 'ai-cursor'

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''       // SSE line buffer
  let markdownBuf = ''  // accumulated raw text from AI

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') {
        cursor.remove()
        isStreaming = false
        return
      }

      try {
        const json = JSON.parse(payload)
        const content = json.choices?.[0]?.delta?.content
        if (content) {
          markdownBuf += content
          // Re-render markdown on each chunk
          container.innerHTML = parseMarkdown(markdownBuf)
          container.appendChild(cursor)
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  cursor.remove()
  isStreaming = false
}

/* ============================================================
   Streaming Typewriter — character-by-character with markdown
   ============================================================ */
function streamContent(container, rawText, scrollContainer) {
  container.innerHTML = ''

  // Parse markdown-like content into HTML
  const html = parseMarkdown(rawText)

  // Stream character by character
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  const fullText = tempDiv.innerHTML

  let index = 0
  let inTag = false
  const speed = 12 // ms per character

  // Add cursor
  const cursor = document.createElement('span')
  cursor.className = 'ai-cursor'

  function typeNext() {
    if (index >= fullText.length) {
      cursor.remove()
      isStreaming = false
      return
    }

    const char = fullText[index]

    // Skip through HTML tags instantly
    if (char === '<') {
      inTag = true
      let tagEnd = fullText.indexOf('>', index)
      if (tagEnd !== -1) {
        container.innerHTML = fullText.substring(0, tagEnd + 1)
        index = tagEnd + 1
        container.appendChild(cursor)
        requestAnimationFrame(typeNext)
        return
      }
    }

    if (char === '>') {
      inTag = false
    }

    index++
    container.innerHTML = fullText.substring(0, index)
    container.appendChild(cursor)

    // Auto-scroll to bottom
    scrollContainer.scrollTop = scrollContainer.scrollHeight

    // Variable speed: pause longer on punctuation
    let delay = speed
    if ('。！？，；：'.includes(char)) delay = speed * 6
    else if ('、'.includes(char)) delay = speed * 3
    else if ('\u201c\u201d\u2018\u2019'.includes(char)) delay = speed * 2

    setTimeout(typeNext, delay)
  }

  requestAnimationFrame(typeNext)
}

/* ============================================================
   Simple Markdown Parser
   ============================================================ */
function parseMarkdown(text) {
  return text
    .trim()
    .split('\n')
    .map(line => {
      line = line.trim()
      if (!line) return ''
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
      if (line.startsWith('**') && line.endsWith('**')) return `<p><strong>${line.slice(2, -2)}</strong></p>`
      // Bold within line
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>')
      return `<p>${line}</p>`
    })
    .filter(Boolean)
    .join('\n')
}
