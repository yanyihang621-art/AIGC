/**
 * server.js — 寻迹华夏 后端中转服务
 * 
 * 职责：
 * 1. 接收前端的省份请求
 * 2. 调用 DeepSeek API（stream: true）
 * 3. 以 SSE (Server-Sent Events) 格式实时转发给前端
 * 4. 缓存已生成的省份内容，相同省份不再重复调用 API
 * 
 * 启动方式：node server.js
 * 默认端口：3001
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3001
const API_KEY = process.env.DEEPSEEK_API_KEY
const API_URL = 'https://api.deepseek.com/chat/completions'

app.use(cors())
app.use(express.json())

/* ============================================================
   Server-side Cache — 缓存已生成的省份内容，节省 Token
   ============================================================ */
const responseCache = new Map()  // "province|era" -> fullText
const MAX_CACHE_SIZE = 200       // 34 provinces * 6 eras

function cacheResponse(province, text) {
  // 简单的 LRU：超出上限删除最早的
  if (responseCache.size >= MAX_CACHE_SIZE && !responseCache.has(province)) {
    const firstKey = responseCache.keys().next().value
    responseCache.delete(firstKey)
  }
  responseCache.set(province, text)
}

/* ============================================================
   System Prompt — 控制 AI 输出的语气与格式
   ============================================================ */
const SYSTEM_PROMPT = `你是"寻迹华夏"文化地图的 AI 叙事引擎，专门为中国各省份在不同历史时期撰写精炼的文化散文。

## 核心机制
你将收到两个坐标：一个【地点】和一个【时代】。你需要像一位学识渊博的历史学者，精确定位到该地在该时代的文化风貌进行叙述。
- 如果某个省份在该时代尚未设省或名称不同，请使用该时期的历史地名（如唐代的陕西可称"关中"或"京畿"，先秦的四川可称"巴蜀"）。
- 非遗项目应选择在该时代已经存在或萌芽的技艺，如果某项非遗在该时代尚未出现，请选择该时代该地真实存在的代表性工艺或艺术形式。
- 历史名士必须是该时代与该地渊源深厚的真实人物，严禁时代错位。

## 风格要求
- 语言：典雅的古风散文体，兼具余秋雨《文化苦旅》的深邃与汪曾祺散文的灵动。行文讲究节奏感，长短句交替。
- 禁止使用 emoji、网络用语、现代营销话术、"欢迎来到"等导游词句式。
- 追求意象鲜明、情感克制、文字凝练。

## 输出结构（严格遵守）

第一段（无标题）：用2-3句话勾勒该地在该时代的文化气质与历史定位，要有画面感和时代感。

### 非遗瑰宝
介绍2项在该时代该地已存在的代表性技艺或艺术形式。每项格式如下：
**[技艺名称]**，然后用1-2句诗意的描述，突出其工艺精髓与美学特征。确保所选技艺与时代吻合。

### 历史名士
提及2-3位该时代与该地渊源深厚的历史文化人物。每位名士的介绍需遵循以下规格以保证排版美感：
- 用一句连贯的文字概括其生平与成就（控制在30-40字左右，以使其在卡片左侧呈现约2-3行的丰满度）。
- 在介绍中引用其最经典的代表性名言或诗句（必须用双引号标注，字数严格控制在10-14字左右。要求是工整的双句五言或七言诗，或是字数对称的经典名言。避免过长或过短的单句，以便右侧竖排美观）。

## 格式规范
- 使用 Markdown：### 作为二级标题，** 加粗非遗名称
- 每段控制在50-80字，全文不超过350字
- 段落之间用空行分隔
- 不要编号，不要列表符号（- 或 1.）`

/* ============================================================
   POST /api/culture — 流式文化内容生成（带缓存）
   ============================================================ */
app.post('/api/culture', async (req, res) => {
  const { location, era } = req.body
  const currentEra = era || '远古至先秦'
  const cacheKey = `${location}|${currentEra}`

  if (!location) {
    return res.status(400).json({ error: '缺少 location 参数' })
  }

  if (!API_KEY || API_KEY === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    // API Key 未配置，返回提示
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const msg = `### ⚠ API Key 未配置\n\n请在项目根目录的 \`.env\` 文件中，将 \`DEEPSEEK_API_KEY\` 替换为你的真实 API Key，然后重启后端服务。\n\n当前使用的是占位符。`
    const chars = [...msg]
    for (const char of chars) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // ---- 命中缓存：直接返回，不调用 API ----
  if (responseCache.has(cacheKey)) {
    console.log(`  [缓存命中] ${cacheKey}`)
    const cached = responseCache.get(cacheKey)
    // 将缓存内容以 SSE 格式批量发送（模拟流式但极快）
    const chars = [...cached]
    const BATCH = 10  // 每 10 个字符打包发送，减少 SSE 帧数
    for (let i = 0; i < chars.length; i += BATCH) {
      const batch = chars.slice(i, i + BATCH).join('')
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: batch } }] })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // ---- 未命中缓存：调用 DeepSeek API（流式） ----
  console.log(`  [API 调用] ${cacheKey}`)
  const userMessage = `地点：${location}，时代：${currentEra}`
  let fullResponseText = ''   // 用于缓存完整回答

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 600,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`DeepSeek API 错误 [${response.status}]:`, errorText)
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n*API 请求失败 (${response.status})，请检查 API Key 是否正确。*` } }] })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // 逐块转发 DeepSeek 的 SSE 流，同时收集完整文本用于缓存
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      // 转发原始 SSE 数据给前端
      res.write(chunk)

      // 从 SSE 数据中提取文本内容用于缓存
      sseBuffer += chunk
      const sseLines = sseBuffer.split('\n')
      sseBuffer = sseLines.pop() // 保留不完整的行
      for (const line of sseLines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const content = json?.choices?.[0]?.delta?.content ?? ''
          fullResponseText += content
        } catch (_) { /* 跳过解析失败的行 */ }
      }
    }

    // 缓存完整回答
    if (fullResponseText.trim()) {
      cacheResponse(cacheKey, fullResponseText)
      console.log(`  [已缓存] ${cacheKey} (${fullResponseText.length} 字)`)
    }

    res.end()
  } catch (err) {
    console.error('服务器错误:', err.message)
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n*网络连接失败，请检查网络环境。*` } }] })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
})

/* ============================================================
   POST /api/chat — 会名士 · 跨时空对话（流式角色扮演）
   ============================================================ */

const CHAT_SYSTEM_PROMPT_TEMPLATE = (era, province, npcName) => `# 角色扮演指令

你是【${npcName}】本人。你的名字就是【${npcName}】。你活在【${era}】时期。

## 绝对禁令
- 你就是【${npcName}】，不是别人。绝对禁止扮演任何其他历史人物。
- 即使【${npcName}】的历史籍贯与用户当前探索的地区【${province}】不同，你的身份仍然是【${npcName}】，绝不可更换角色。
- 你的自我介绍、生平叙述、著作引用都必须是【${npcName}】本人的真实历史内容。
- 绝对不能说"我是AI"或跳出角色。

## 场景背景
用户正在"寻迹华夏"文化地图中探索【${province}】地区的【${era}】时期文化。你作为【${npcName}】，被邀请与这位远方来客交谈。

## 角色规则
1. **第一次回复**时，请以【${npcName}】的真实身份进行自我介绍，包括你的真实姓名、籍贯、主要成就或代表作。
2. 使用半文言文或符合你所处时代的典雅白话，措辞古朴但不晦涩。禁止现代网络用语、emoji和英文。
3. 你的性格、言行、观点必须符合【${npcName}】的真实历史记载。
4. 你的知识严格限定在你生活的历史时期，不知道身后之事。若用户问及超出你时代的事物，请以古人的好奇视角回应。
5. 用户是穿越时空的现代旅人，你对其到来感到新奇和欢迎。

## 回复规范
- 每次回复80-200字，不要太长
- 自然融入你的生平故事或经典名言
- 保持对话感，适时反问用户
- 段落之间用换行分隔`

app.post('/api/chat', async (req, res) => {
  const { province, era, npcName, messages } = req.body

  if (!province || !era) {
    return res.status(400).json({ error: '缺少 province 或 era 参数' })
  }

  if (!API_KEY || API_KEY === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const msg = `在下尚未与天地接通灵犀……\n\n（请在 .env 文件中配置 DEEPSEEK_API_KEY，然后重启后端服务。）`
    for (const char of [...msg]) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // Build conversation for DeepSeek
  const systemPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE(era, province, npcName)
  const apiMessages = [
    { role: 'system', content: systemPrompt },
  ]

  // Append conversation history (limit to last 20 messages for token control)
  if (Array.isArray(messages)) {
    const recentMessages = messages.slice(-20)
    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i]
      if (msg.role === 'user' || msg.role === 'assistant') {
        // Prepend character lock to the last user message to enforce recency bias attention
        if (msg.role === 'user' && i === recentMessages.length - 1) {
          apiMessages.push({
            role: 'user',
            content: `【重要提醒：你是【${npcName}】本人，不是任何其他人。请以【${npcName}】的身份回答。】\n\n${msg.content}`
          })
        } else {
          apiMessages.push({ role: msg.role, content: msg.content })
        }
      }
    }
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  console.log(`  [会名士] ${era} · ${province} · ${npcName} (${apiMessages.length - 1} 轮对话)`)

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        stream: true,
        temperature: 0.6,
        max_tokens: 400,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`DeepSeek Chat API 错误 [${response.status}]:`, errorText)
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n（名士暂时无法应答，请稍后再试。）` } }] })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // Stream forward
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      res.write(chunk)
    }

    res.end()
  } catch (err) {
    console.error('会名士服务器错误:', err.message)
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n（时空通道暂时断开，请检查网络。）` } }] })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
})

/* ============================================================
   Health Check & Cache Status
   ============================================================ */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!API_KEY && API_KEY !== 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    cachedProvinces: [...responseCache.keys()],
    cacheSize: responseCache.size,
  })
})

/* ============================================================
   POST /api/cache/clear — 手动清除缓存（调试用）
   ============================================================ */
app.post('/api/cache/clear', (req, res) => {
  responseCache.clear()
  console.log('  [缓存已清空]')
  res.json({ status: 'ok', message: '缓存已清空' })
})

/* ============================================================
   Start Server
   ============================================================ */
app.listen(PORT, () => {
  console.log(`\n  寻迹华夏 · 后端服务已启动`)
  console.log(`  ➜  http://localhost:${PORT}`)
  console.log(`  ➜  API Key: ${API_KEY && API_KEY !== 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ? '已配置 ✓' : '未配置 ✗ (请编辑 .env 文件)'}`)
  console.log(`  ➜  缓存机制: 已启用 (最多缓存 ${MAX_CACHE_SIZE} 个省份)`)
  console.log()
})
