/**
 * chat.js — 会名士 · 跨时空对话系统
 * 
 * 职责：
 * 1. 管理名士列表与对话历史状态（WeChat-like Switching）
 * 2. 监听发送按钮点击 & 回车事件
 * 3. 流式解析 SSE 数据并逐字追加到 DOM
 * 4. 自动平滑滚动 + 毛笔光标动画
 */

const CHAT_API = '/api/chat';

/* ============================================================
   Historical NPC Databases
   ============================================================ */
const NPC_DATABASE = {
  '北京': {
    '远古至先秦': [{ name: '燕昭王', title: '黄金台招贤' }, { name: '荆轲', title: '图穷匕见' }],
    '秦汉': [{ name: '卢生', title: '秦代方士' }],
    '魏晋南北朝': [{ name: '刘放', title: '三国魏臣' }],
    '隋唐': [{ name: '陈子昂', title: '登幽州台歌' }, { name: '张说', title: '幽州都督' }],
    '宋元': [{ name: '耶律楚材', title: '元代重臣' }, { name: '关汉卿', title: '戏曲大家' }],
    '明清': [{ name: '曹雪芹', title: '红楼梦作者' }, { name: '纳兰性德', title: '清代词人' }, { name: '老舍', title: '人民艺术家' }]
  },
  '陕西': {
    '远古至先秦': [{ name: '秦始皇', title: '扫灭六国' }, { name: '周公旦', title: '制礼作乐' }, { name: '商鞅', title: '立木为信' }],
    '秦汉': [{ name: '司马迁', title: '史记作者' }, { name: '张骞', title: '凿空西域' }, { name: '汉武帝', title: '开疆拓土' }],
    '魏晋南北朝': [{ name: '鸠摩罗什', title: '译经大师' }, { name: '苻坚', title: '前秦大帝' }],
    '隋唐': [{ name: '李白', title: '诗仙' }, { name: '杜甫', title: '诗圣' }, { name: '唐太宗', title: '贞观之治' }, { name: '王维', title: '诗佛' }],
    '宋元': [{ name: '张载', title: '北宋关学大家' }, { name: '寇准', title: '北宋名相' }],
    '明清': [{ name: '李自成', title: '闯王' }, { name: '王征', title: '关中奇人' }]
  },
  '四川': {
    '远古至先秦': [{ name: '蚕丛', title: '古蜀先祖' }, { name: '李冰', title: '都江堰主持者' }],
    '秦汉': [{ name: '司马相如', title: '汉赋大家' }, { name: '卓文君', title: '当垆卖酒' }, { name: '扬雄', title: '蜀中才子' }],
    '魏晋南北朝': [{ name: '诸葛亮', title: '蜀汉丞相' }, { name: '刘备', title: '蜀汉昭烈帝' }, { name: '陈寿', title: '三国志作者' }],
    '隋唐': [{ name: '李白', title: '蜀道难' }, { name: '杜甫', title: '浣花草堂' }, { name: '薛涛', title: '吟诗制笺' }],
    '宋元': [{ name: '苏轼', title: '东坡居士' }, { name: '苏洵', title: '老泉先生' }, { name: '苏辙', title: '颍滨遗老' }, { name: '陆游', title: '客蜀爱国诗翁' }],
    '明清': [{ name: '杨慎', title: '临江仙作者' }, { name: '李调元', title: '川剧之祖' }]
  },
  '山东': {
    '远古至先秦': [{ name: '孔子', title: '万世师表' }, { name: '孟子', title: '亚圣' }, { name: '墨子', title: '兼爱非攻' }, { name: '姜子牙', title: '齐国始祖' }],
    '秦汉': [{ name: '东方朔', title: '滑稽大家' }, { name: '诸葛亮', title: '琅琊诸葛' }],
    '魏晋南北朝': [{ name: '王羲之', title: '琅琊书圣' }, { name: '刘勰', title: '文心雕龙作者' }],
    '隋唐': [{ name: '秦琼', title: '山东好汉' }],
    '宋元': [{ name: '辛弃疾', title: '稼轩居士' }, { name: '李清照', title: '易安词女' }],
    '明清': [{ name: '蒲松龄', title: '聊斋先生' }, { name: '孔尚任', title: '桃花扇作者' }]
  },
  '浙江': {
    '远古至先秦': [{ name: '勾践', title: '卧薪尝胆' }, { name: '西施', title: '浣纱溪畔' }],
    '秦汉': [{ name: '严子陵', title: '富春山隐士' }, { name: '王充', title: '论衡作者' }],
    '魏晋南北朝': [{ name: '王羲之', title: '会稽兰亭' }, { name: '谢灵运', title: '山水诗鼻祖' }],
    '隋唐': [{ name: '贺知章', title: '回乡偶书' }, { name: '寒山', title: '和合二仙' }],
    '宋元': [{ name: '陆游', title: '沈园遗恨' }, { name: '林逋', title: '梅妻鹤子' }, { name: '沈括', title: '梦溪笔谈' }],
    '明清': [{ name: '王阳明', title: '心学集大成者' }, { name: '黄宗羲', title: '明夷待访录' }, { name: '鲁迅', title: '民族魂' }]
  },
  '江苏': {
    '远古至先秦': [{ name: '伍子胥', title: '筑吴国城' }, { name: '专诸', title: '鱼腹藏剑' }],
    '秦汉': [{ name: '项羽', title: '西楚霸王' }, { name: '韩信', title: '国士无双' }, { name: '刘邦', title: '大风歌' }],
    '魏晋南北朝': [{ name: '祖冲之', title: '圆周率先驱' }, { name: '顾恺之', title: '画绝' }],
    '隋唐': [{ name: '刘禹锡', title: '陋室铭' }, { name: '张若虚', title: '春江花月夜' }],
    '宋元': [{ name: '范仲淹', title: '忧乐天下' }, { name: '柳永', title: '雨霖铃' }, { name: '秦观', title: '鹊桥仙' }],
    '明清': [{ name: '唐伯虎', title: '桃花庵主' }, { name: '郑板桥', title: '难得糊涂' }, { name: '施耐庵', title: '水浒传作者' }, { name: '曹雪芹', title: '红楼梦梦源' }]
  },
  '河南': {
    '远古至先秦': [{ name: '老子', title: '道德经作者' }, { name: '庄子', title: '逍遥游' }, { name: '商鞅', title: '卫国法家' }, { name: '韩非子', title: '法家集大成' }],
    '秦汉': [{ name: '张仲景', title: '医圣' }, { name: '张衡', title: '科圣地动仪' }, { name: '蔡伦', title: '改进造纸术' }],
    '魏晋南北朝': [{ name: '阮籍', title: '竹林七贤' }, { name: '嵇康', title: '广陵散绝' }],
    '隋唐': [{ name: '杜甫', title: '河南巩县' }, { name: '韩愈', title: '文起八代之衰' }, { name: '白居易', title: '琵琶行' }, { name: '玄奘', title: '西行求法' }],
    '宋元': [{ name: '程颐', title: '理学先驱' }, { name: '岳飞', title: '精忠报国' }],
    '明清': [{ name: '李贺', title: '诗鬼后裔' }, { name: '史可法', title: '抗清名将' }]
  },
  '湖南': {
    '远古至先秦': [{ name: '屈原', title: '楚辞离骚' }, { name: '虞舜', title: '崩于苍梧' }],
    '秦汉': [{ name: '贾谊', title: '过秦论' }, { name: '蔡伦', title: '衡阳造纸' }],
    '魏晋南北朝': [{ name: '陶渊明', title: '桃花源记' }],
    '隋唐': [{ name: '怀素', title: '草圣狂草' }, { name: '柳宗元', title: '永州八记' }],
    '宋元': [{ name: '周敦颐', title: '爱莲说' }, { name: '朱熹', title: '主讲岳麓书院' }],
    '明清': [{ name: '王夫之', title: '船山先生' }, { name: '魏源', title: '睁眼看世界' }, { name: '曾国藩', title: '湘军统帅' }]
  }
};

const FALLBACK_NPC_DATABASE = {
  '远古至先秦': [{ name: '孔子', title: '万世师表' }, { name: '屈原', title: '楚辞大家' }, { name: '老子', title: '道祖' }],
  '秦汉': [{ name: '司马迁', title: '史圣' }, { name: '张骞', title: '丝路拓荒人' }, { name: '韩信', title: '兵仙' }],
  '魏晋南北朝': [{ name: '王羲之', title: '书圣' }, { name: '诸葛亮', title: '卧龙先生' }, { name: '陶渊明', title: '五柳先生' }],
  '隋唐': [{ name: '李白', title: '诗仙' }, { name: '杜甫', title: '诗圣' }, { name: '白居易', title: '诗魔' }, { name: '玄奘', title: '三藏法师' }],
  '宋元': [{ name: '苏轼', title: '东坡居士' }, { name: '李清照', title: '易安词女' }, { name: '辛弃疾', title: '豪放词人' }],
  '明清': [{ name: '王阳明', title: '心学宗师' }, { name: '曹雪芹', title: '红楼著书人' }, { name: '郑板桥', title: '难得糊涂' }]
};

/* ============================================================
   Chat State
   ============================================================ */
const chatState = {
  messages: [],      // 当前会话的消息列表
  history: {},       // 对话历史缓存，键为名士名字：{ [npcName]: [{role, content}] }
  isStreaming: false,
  abortController: null,
  activeNpc: null,   // 当前选中的名士对象：{ name, title }
  npcs: [],          // 当前省份与朝代下的名士列表
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
let chatNpcList = null;

function ensureDomRefs() {
  chatScrollArea = document.getElementById('chat-scroll-area');
  chatMessages = document.getElementById('chat-messages');
  chatInput = document.getElementById('chat-input');
  chatSendBtn = document.getElementById('chat-send-btn');
  chatNpcName = document.getElementById('chat-npc-name');
  chatEmptyState = document.getElementById('chat-empty-state');
  chatNpcList = document.getElementById('chat-npc-list');
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
  chatState.history = {};
  chatState.activeNpc = null;
  chatState.npcs = [];
  chatState.isStreaming = false;

  if (chatState.abortController) {
    chatState.abortController.abort();
    chatState.abortController = null;
  }

  ensureDomRefs();
  if (chatMessages) chatMessages.innerHTML = '';
  if (chatEmptyState) chatEmptyState.style.display = 'flex';
  if (chatNpcName) chatNpcName.textContent = '待寻访';
  if (chatNpcList) chatNpcList.innerHTML = '';
  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }
}

/* ============================================================
   Select a historical NPC
   ============================================================ */
function selectNpc(npc) {
  if (!npc) return;

  // Abort active stream if any
  if (chatState.isStreaming && chatState.abortController) {
    chatState.abortController.abort();
    chatState.isStreaming = false;
    chatSendBtn.disabled = false;
    chatSendBtn.classList.remove('sending');
  }

  chatState.activeNpc = npc;

  // Update active class in sidebar
  ensureDomRefs();
  if (chatNpcList) {
    const items = chatNpcList.querySelectorAll('.chat-npc-item');
    items.forEach(item => {
      if (item.getAttribute('data-name') === npc.name) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Update context bar
  if (chatNpcName) {
    chatNpcName.textContent = `${npc.name} (${npc.title})`;
  }

  // Restore messages from history map
  if (!chatState.history[npc.name]) {
    chatState.history[npc.name] = [];
  }
  chatState.messages = chatState.history[npc.name];

  // Render restored history
  renderMessages();
}

/* ============================================================
   Render all messages in current history
   ============================================================ */
function renderMessages() {
  ensureDomRefs();
  if (!chatMessages) return;
  chatMessages.innerHTML = '';

  if (chatState.messages.length === 0) {
    if (chatEmptyState) chatEmptyState.style.display = 'flex';
  } else {
    if (chatEmptyState) chatEmptyState.style.display = 'none';
    chatState.messages.forEach(msg => {
      if (msg.role === 'user') {
        renderUserMessageDirectly(msg.content);
      } else if (msg.role === 'assistant') {
        renderAssistantMessageDirectly(msg.content);
      }
    });
  }
  scrollToBottom();
}

function renderUserMessageDirectly(text) {
  const entry = document.createElement('div');
  entry.className = 'chat-entry chat-entry-user';

  const stamp = document.createElement('span');
  stamp.className = 'chat-stamp-user';
  stamp.textContent = '客';

  const content = document.createElement('div');
  content.className = 'chat-text-user';
  content.textContent = text;

  entry.appendChild(stamp);
  entry.appendChild(content);
  chatMessages.appendChild(entry);

  const divider = document.createElement('div');
  divider.className = 'chat-divider';
  chatMessages.appendChild(divider);
}

function renderAssistantMessageDirectly(text) {
  const entry = document.createElement('div');
  entry.className = 'chat-entry chat-entry-npc';

  const stamp = document.createElement('span');
  stamp.className = 'chat-stamp-npc';
  stamp.textContent = '士';

  const content = document.createElement('div');
  content.className = 'chat-text-npc';
  
  const paragraphs = text.split('\n').filter(p => p.trim());
  let html = '';
  for (const para of paragraphs) {
    html += `<p>${escapeHtml(para)}</p>`;
  }
  content.innerHTML = html;

  entry.appendChild(stamp);
  entry.appendChild(content);
  chatMessages.appendChild(entry);
}

/* ============================================================
   Handle Send Message
   ============================================================ */
async function handleSend(getGlobalState) {
  if (chatState.isStreaming) return;

  ensureDomRefs();
  const text = chatInput.value.trim();
  if (!text) return;

  if (!chatState.activeNpc) {
    appendSystemNote('请先在左侧名录中选择一位名士');
    return;
  }

  const { province, era } = getGlobalState();

  // Hide empty state
  if (chatEmptyState) chatEmptyState.style.display = 'none';

  // Add user message to history
  chatState.messages.push({ role: 'user', content: text });

  // Render user message
  renderUserMessageDirectly(text);

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
      npcName: chatState.activeNpc ? chatState.activeNpc.name : '',
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
  
  // Reset chat state
  chatState.messages = [];
  chatState.history = {};
  chatState.activeNpc = null;
  
  if (chatMessages) chatMessages.innerHTML = '';
  if (chatEmptyState) chatEmptyState.style.display = 'flex';
  if (chatInput) {
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  if (!province) {
    if (chatNpcName) chatNpcName.textContent = '待寻访';
    if (chatNpcList) chatNpcList.innerHTML = '';
    return;
  }

  // Get NPCs from database or fallback
  let npcs = [];
  if (NPC_DATABASE[province] && NPC_DATABASE[province][era]) {
    npcs = NPC_DATABASE[province][era];
  } else {
    npcs = FALLBACK_NPC_DATABASE[era] || [];
  }

  chatState.npcs = npcs;

  // Render NPC list
  if (chatNpcList) {
    chatNpcList.innerHTML = '';
    npcs.forEach((npc) => {
      const item = document.createElement('div');
      item.className = 'chat-npc-item';
      item.setAttribute('role', 'option');
      item.setAttribute('data-name', npc.name);

      const nameEl = document.createElement('span');
      nameEl.className = 'npc-name';
      nameEl.textContent = npc.name;

      const titleEl = document.createElement('span');
      titleEl.className = 'npc-title';
      titleEl.textContent = npc.title;

      item.appendChild(nameEl);
      item.appendChild(titleEl);

      item.addEventListener('click', () => {
        if (chatState.isStreaming) return;
        selectNpc(npc);
      });

      chatNpcList.appendChild(item);
    });
  }

  // Select first NPC by default
  if (npcs.length > 0) {
    selectNpc(npcs[0]);
  } else {
    if (chatNpcName) chatNpcName.textContent = '暂无名士';
  }
}
