/**
 * server.js — 寻迹华夏 后端中转服务
 * 
 * 职责：
 * 1. 接收前端的省份请求
 * 2. 调用 DeepSeek API（stream: true）
 * 3. 以 SSE (Server-Sent Events) 格式实时转发给前端
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
   System Prompt — 控制 AI 输出的语气与格式
   ============================================================ */
const SYSTEM_PROMPT = `你是"寻迹华夏"文化地图的AI叙事引擎。用户会告诉你一个中国省份名称，你需要为其生成一段优美的文化介绍。

要求：
1. 语言风格：典雅的古风散文体，类似余秋雨《文化苦旅》的笔触，但更加凝练。
2. 结构：
   - 第一段：该地域的文化定位与气质（2-3句）
   - 用"### 非遗瑰宝"作为标题，介绍2个代表性非物质文化遗产，每个用粗体标注名称并附一段诗意的描述
   - 用"### 历史名士"作为标题，提及2-3位与该地有关的历史文化人物，引用其代表性名句或事迹
3. 每段控制在50-80字，整体不超过400字。
4. 禁止使用emoji、网络用语或现代营销话术。
5. 使用Markdown格式（### 和 ** 加粗）。`

/* ============================================================
   POST /api/culture — 流式文化内容生成
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

  try {
    // 调用 DeepSeek API（流式）
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
          { role: 'user', content: `请为"${location}"生成文化介绍。` },
        ],
        stream: true,
        temperature: 0.8,
        max_tokens: 800,
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

    // 逐块转发 DeepSeek 的 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      // 直接转发原始 SSE 数据
      res.write(chunk)
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
   Health Check
   ============================================================ */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!API_KEY && API_KEY !== 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
})

/* ============================================================
   Start Server
   ============================================================ */
app.listen(PORT, () => {
  console.log(`\n  寻迹华夏 · 后端服务已启动`)
  console.log(`  ➜  http://localhost:${PORT}`)
  console.log(`  ➜  API Key: ${API_KEY && API_KEY !== 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ? '已配置 ✓' : '未配置 ✗ (请编辑 .env 文件)'}`)
  console.log()
})
