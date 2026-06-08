/**
 * chat.js — 会名士 · 跨时空对话系统
 * 
 * 职责：
 * 1. 管理对话历史状态（Message History Array）
 * 2. 监听发送按钮点击 & 回车事件
 * 3. 流式解析 SSE 数据并逐字追加到 DOM
 * 4. 自动平滑滚动 + 毛笔光标动画
 */

const CHAT_API = '/api/chat';

/* ============================================================
   Chat State
   ============================================================ */
const chatState = {
  messages: [],      // { role: 'user'|'assistant', content: string }
  isStreaming: false,
  abortController: null,
  currentNpc: '',    // 当前名士名称（由 AI 动态匹配）
};

/* ============================================================
   DOM References (lazily initialized)
   ============================================================ */
let chatScrollArea = null;
let chatMessages = null;
let chatInput = null;
let chatSendBtn = null;
let chatNpcName = null;
let chatEmptyState = null;

function ensureDomRefs() {
  chatScrollArea = document.getElementById('chat-scroll-area');
  chatMessages = document.getElementById('chat-messages');
  chatInput = document.getElementById('chat-input');
  chatSendBtn = document.getElementById('chat-send-btn');
  chatNpcName = document.getElementById('chat-npc-name');
  chatEmptyState = document.getElementById('chat-empty-state');
}

/* ============================================================
   Initialize Chat Module
   ============================================================ */
export function initChat(getGlobalState) {
  ensureDomRefs();
  if (!chatInput || !chatSendBtn) return;

  // Send on click
  chatSendBtn.addEventListener('click', () => {
    handleSend(getGlobalState);
  });

  // Send on Enter (Shift+Enter for newline)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(getGlobalState);
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });
}

/* ============================================================
   Reset chat when province/era changes
   ============================================================ */
export function resetChat() {
  chatState.messages = [];
  chatState.currentNpc = '';
  chatState.isStreaming = false;
  if (chatState.abortController) {
    chatState.abortController.abort();
    chatState.abortController = null;
  }

  ensureDomRefs();
  if (chatMessages) chatMessages.innerHTML = '';
  if (chatEmptyState) chatEmptyState.style.display = 'flex';
  if (chatNpcName) chatNpcName.textContent = '待寻访';
  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }
}

/* ============================================================
   Handle Send Message
   ============================================================ */
async function handleSend(getGlobalState) {
  if (chatState.isStreaming) return;

  ensureDomRefs();
  const text = chatInput.value.trim();
  if (!text) return;

  const { province, era } = getGlobalState();
  if (!province) {
    appendSystemNote('请先在地图上选择一个省份');
    return;
  }

  // Hide empty state
  if (chatEmptyState) chatEmptyState.style.display = 'none';

  // Add user message to history
  chatState.messages.push({ role: 'user', content: text });

  // Render user message
  appendUserMessage(text);

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Start streaming AI response
  chatState.isStreaming = true;
  chatState.abortController = new AbortController();

  // Disable send button
  chatSendBtn.disabled = true;
  chatSendBtn.classList.add('sending');

  try {
    await streamChatResponse(province, era, chatState.abortController.signal);
  } catch (err) {
    if (err.name !== 'AbortError') {
      appendSystemNote('连接失败，请检查网络后重试');
      console.error('Chat stream error:', err);
    }
  } finally {
    chatState.isStreaming = false;
    chatSendBtn.disabled = false;
    chatSendBtn.classList.remove('sending');
  }
}

/* ============================================================
   SSE Streaming — 流式渲染名士回复
   ============================================================ */
async function streamChatResponse(province, era, signal) {
  const response = await fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      province,
      era,
      messages: chatState.messages,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Create assistant message container
  const { contentEl, cursorEl } = appendAssistantMessage();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';

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
        cursorEl.remove();
        // Save assistant response to history
        chatState.messages.push({ role: 'assistant', content: accumulatedText });
        return;
      }

      try {
        const json = JSON.parse(data);
        const chunk = json?.choices?.[0]?.delta?.content ?? '';
        if (chunk) {
          accumulatedText += chunk;
          // Render inline — simple text with paragraph breaks
          renderAssistantText(contentEl, accumulatedText, cursorEl);
          scrollToBottom();
        }
      } catch (_) { /* skip */ }
    }
  }

  cursorEl.remove();
  if (accumulatedText) {
    chatState.messages.push({ role: 'assistant', content: accumulatedText });
  }
}

/* ============================================================
   DOM Rendering — 古籍风格排版（非气泡）
   ============================================================ */

/** Append user message — styled as a reader's annotation */
function appendUserMessage(text) {
  ensureDomRefs();

  const entry = document.createElement('div');
  entry.className = 'chat-entry chat-entry-user';

  const stamp = document.createElement('span');
  stamp.className = 'chat-stamp-user';
  stamp.textContent = '客';
  stamp.setAttribute('aria-label', '旅人');

  const content = document.createElement('div');
  content.className = 'chat-text-user';
  content.textContent = text;

  entry.appendChild(stamp);
  entry.appendChild(content);
  chatMessages.appendChild(entry);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'chat-divider';
  chatMessages.appendChild(divider);

  scrollToBottom();
}

/** Append assistant message container — returns refs for streaming */
function appendAssistantMessage() {
  ensureDomRefs();

  const entry = document.createElement('div');
  entry.className = 'chat-entry chat-entry-npc';

  const stamp = document.createElement('span');
  stamp.className = 'chat-stamp-npc';
  stamp.textContent = '士';
  stamp.setAttribute('aria-label', '名士');

  const content = document.createElement('div');
  content.className = 'chat-text-npc';

  const cursor = document.createElement('span');
  cursor.className = 'chat-brush-cursor';

  content.appendChild(cursor);
  entry.appendChild(stamp);
  entry.appendChild(content);
  chatMessages.appendChild(entry);

  return { contentEl: content, cursorEl: cursor };
}

/** Render streaming text into the assistant content element */
function renderAssistantText(contentEl, fullText, cursorEl) {
  // Parse line breaks into paragraphs
  const paragraphs = fullText.split('\n').filter(p => p.trim());
  let html = '';
  for (const para of paragraphs) {
    html += `<p>${escapeHtml(para)}</p>`;
  }
  contentEl.innerHTML = html;
  contentEl.appendChild(cursorEl);
}

/** Append system note (non-NPC, non-user) */
function appendSystemNote(text) {
  ensureDomRefs();
  const note = document.createElement('div');
  note.className = 'chat-system-note';
  note.textContent = text;
  chatMessages.appendChild(note);
  scrollToBottom();
}

/* ============================================================
   Utilities
   ============================================================ */
function scrollToBottom() {
  if (chatScrollArea) {
    chatScrollArea.scrollTo({
      top: chatScrollArea.scrollHeight,
      behavior: 'smooth',
    });
  }
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Update the NPC name display (called externally when province/era changes)
 */
export function updateNpcContext(province, era) {
  ensureDomRefs();
  if (chatNpcName) {
    chatNpcName.textContent = province ? `${era} · ${province}` : '待寻访';
  }
}
