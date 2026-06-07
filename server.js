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
const responseCache = new Map()  // province -> fullText
const MAX_CACHE_SIZE = 34        // 中国省级行政区数量

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
const SYSTEM_PROMPT = `你是"寻迹华夏"文化地图的 AI 叙事引擎，专门为中国各省份撰写精炼的文化散文。

## 风格要求
- 语言：典雅的古风散文体，兼具余秋雨《文化苦旅》的深邃与汪曾祺散文的灵动。行文讲究节奏感，长短句交替。
- 禁止使用 emoji、网络用语、现代营销话术、"欢迎来到"等导游词句式。
- 追求意象鲜明、情感克制、文字凝练。

## 输出结构（严格遵守）

第一段（无标题）：用2-3句话勾勒该省的文化气质与地理人文定位，要有画面感。

### 非遗瑰宝
介绍2项该省最具代表性的国家级非物质文化遗产。每项格式如下：
**[遗产名称]**，然后用1-2句诗意的描述，突出其工艺精髓与美学特征。注意选取真实存在且确属该省的非遗项目。

### 历史名士
提及2-3位与该省渊源深厚的历史文化人物。每人用1句话概括其成就，并引用其一句代表性名言或诗句（用引号标注）。确保人物与地域的关联真实准确。

## 格式规范
- 使用 Markdown：### 作为二级标题，** 加粗非遗名称
- 每段控制在50-80字，全文不超过350字
- 段落之间用空行分隔
- 不要编号，不要列表符号（- 或 1.）`

/* ============================================================
   POST /api/culture — 流式文化内容生成（带缓存）
   ============================================================ */
app.post('/api/culture', async (req, res) => {
  const { location } = req.body

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
  if (responseCache.has(location)) {
    console.log(`  [缓存命中] ${location}`)
    const cached = responseCache.get(location)
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
  console.log(`  [API 调用] ${location}`)
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
          { role: 'user', content: `${location}` },
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
      cacheResponse(location, fullResponseText)
      console.log(`  [已缓存] ${location} (${fullResponseText.length} 字)`)
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
