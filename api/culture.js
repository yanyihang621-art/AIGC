const API_KEY = process.env.DEEPSEEK_API_KEY
const API_URL = 'https://api.deepseek.com/chat/completions'

// Server-side cache (ephemeral in serverless but works for warm containers)
const responseCache = new Map()
const MAX_CACHE_SIZE = 34

function cacheResponse(province, text) {
  if (responseCache.size >= MAX_CACHE_SIZE && !responseCache.has(province)) {
    const firstKey = responseCache.keys().next().value
    responseCache.delete(firstKey)
  }
  responseCache.set(province, text)
}

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

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { location } = req.body || {}

  if (!location) {
    return res.status(400).json({ error: '缺少 location 参数' })
  }

  if (!API_KEY || API_KEY === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    const msg = `### ⚠ API Key 未配置\n\n请在 Vercel 项目设置中的 Environment Variables 配置 \`DEEPSEEK_API_KEY\` 环境变量，然后重新部署。\n\n当前使用的是占位符。`
    const chars = [...msg]
    for (const char of chars) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  // Cache hit
  if (responseCache.has(location)) {
    const cached = responseCache.get(location)
    const chars = [...cached]
    const BATCH = 10
    for (let i = 0; i < chars.length; i += BATCH) {
      const batch = chars.slice(i, i + BATCH).join('')
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: batch } }] })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

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
      console.error('API Error:', errorText)
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n*API 请求失败 (${response.status})，请检查 Vercel 环境变量配置。*` } }] })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let sseBuffer = ''
    let fullResponseText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      res.write(chunk)

      sseBuffer += chunk
      const sseLines = sseBuffer.split('\n')
      sseBuffer = sseLines.pop()
      for (const line of sseLines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const content = json?.choices?.[0]?.delta?.content ?? ''
          fullResponseText += content
        } catch (_) {}
      }
    }

    if (fullResponseText.trim()) {
      cacheResponse(location, fullResponseText)
    }

    res.end()
  } catch (err) {
    console.error('Serverless error:', err)
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n*网络连接失败: ${err.message}*` } }] })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
}
