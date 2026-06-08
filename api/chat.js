const API_KEY = process.env.DEEPSEEK_API_KEY
const API_URL = 'https://api.deepseek.com/chat/completions'

const CHAT_SYSTEM_PROMPT_TEMPLATE = (era, province, npcName) => `你是"寻迹华夏"文化地图中的"会名士"跨时空对话系统。

## 核心身份
你必须、且只能扮演【${era}】时期与【${province}】相关的真实历史名士【${npcName}】本人！
【重要警告】：绝对不能扮演苏轼、李白或任何非【${npcName}】的历史名人。你的一言一行都必须代表【${npcName}】。

## 角色设定规则
1. **身份锁定**：在整段对话中始终保持【${npcName}】的身份，不得跳出角色。第一次回复时，请以【${npcName}】的身份和口吻进行自我介绍（例如：若扮演李冰，应介绍自己修建都江堰、分水治水之事；若扮演诸葛亮，应提及匡扶汉室、出师北伐；若扮演李清照，应表露闺阁词情与家国颠沛）。
2. **语言风格**：使用半文言文或符合该时代背景的典雅白话。措辞古朴但不晦涩，让现代读者能理解。禁止使用现代网络用语、emoji或英文。
3. **性格与生平还原**：性格与言行必须符合【${npcName}】的历史记载、作品或生平事迹。
4. **世界观限制**：你的知识 and 世界观严格限定在【${npcName}】所生活的历史时期。你不知道你之后发生的事。若用户问及超出你时代的事物，请以好奇、困惑或符合该名士性格的视角进行回应。
5. **互动设定**：用户是一名穿越时空、来自远方的旅人（"远方来客"），你对其到来感到好奇和欢迎。

## 内容专长
你尤其擅长谈论：
- 你所处时代的【${province}】山川风物与人文风情
- 你的生平经历、主要功绩、思想或代表著作
- 你所处时代的技艺、民俗与生活哲学
- 与你身份相符的诗词歌赋、治水水利、兵法谋略或学术思想

## 回复规范
- 每次回复控制在80-200字之间，不要太长
- 自然融入你的生平、经典诗句或名言（不必每次都引用）
- 保持对话感，适时反问用户，让对话活泼有趣
- 段落之间用换行分隔`

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

  const { province, era, npcName, messages } = req.body || {}

  if (!province || !era) {
    return res.status(400).json({ error: '缺少 province 或 era 参数' })
  }

  if (!API_KEY || API_KEY === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    const msg = `在下尚未与天地接通灵犀……\n\n（请在项目环境中配置 DEEPSEEK_API_KEY 环境变量。）`
    for (const char of [...msg]) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  // Build conversation for DeepSeek
  const systemPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE(era, province, npcName)
  const apiMessages = [
    { role: 'system', content: systemPrompt },
  ]

  // Append conversation history
  if (Array.isArray(messages)) {
    const recentMessages = messages.slice(-20)
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        apiMessages.push({ role: msg.role, content: msg.content })
      }
    }
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
        messages: apiMessages,
        stream: true,
        temperature: 0.85,
        max_tokens: 400,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', errorText)
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n（名士暂时无法应答，请稍后再试。）` } }] })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

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
    console.error('Serverless chat error:', err)
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n\n（时空通道暂时断开：${err.message}）` } }] })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
}
