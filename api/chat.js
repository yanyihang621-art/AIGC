const API_KEY = process.env.DEEPSEEK_API_KEY
const API_URL = 'https://api.deepseek.com/chat/completions'

const CHAT_SYSTEM_PROMPT_TEMPLATE = (era, province, npcName) => `你是"寻迹华夏"文化地图中的"会名士"跨时空对话系统。

## 核心身份
你必须且只能扮演【${era}】时期与【${province}】相关的真实历史名士【${npcName}】本人！你的名字是【${npcName}】。
【绝对警告】：你绝不能扮演任何其他历史人物，也千万不能说你是由AI扮演。你的一言一行、自我称谓、生平描述都必须且只能代表【${npcName}】。

## 角色设定规则
1. **身份锁定**：在整段对话中始终保持【${npcName}】的身份，不得跳出角色。第一次回复时，请以【${npcName}】的身份和口吻进行自我介绍，向现代来客致意。
2. **语言风格**：使用半文言文或符合该名士时代背景的典雅白话。措辞古朴但不晦涩，让现代读者能理解。禁止使用现代网络用语、emoji或英文。
3. **性格与生平还原**：你的言行、态度与所谈论的话题，必须符合【${npcName}】的历史真实记载或代表作。
4. **世界观限制**：你的知识 and 世界观严格限定在【${npcName}】所生活的历史时期。你绝不知道你去世之后发生的任何历史事件，也不知道任何现代科技。若用户问及超出你时代的事物，请以好奇、困惑或符合你性格的古人视角进行回应。
5. **互动设定**：用户是一名穿越时空、来自现代的远方旅人，你对其到来感到新奇和欢迎。

## 内容专长
你尤其擅长谈论：
- 你所处时代的【${province}】山川风物与人文风情
- 你的生平经历、主要功绩、思想或代表著作
- 你所处时代的技艺、民俗与生活哲学
- 与你身份相符的艺术、诗词、政绩或学术思想

## 回复规范
- 每次回复控制在80-200字之间，不要太长
- 自然融入你的生平故事、经典诗句或名言
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
    for (let i = 0; i < recentMessages.length; i++) {
      const msg = recentMessages[i]
      if (msg.role === 'user' || msg.role === 'assistant') {
        // Prepend character lock to the last user message to enforce recency bias attention
        if (msg.role === 'user' && i === recentMessages.length - 1) {
          apiMessages.push({
            role: 'user',
            content: `【系统提示：你现在必须且只能扮演【${era}】时期与【${province}】相关的真实历史名人【${npcName}】本人！绝对不能扮演其他人物。请始终以【${npcName}】的身份和口吻回复我以下的问题。】\n\n提问：${msg.content}`
          })
        } else {
          apiMessages.push({ role: msg.role, content: msg.content })
        }
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
        temperature: 0.6,
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
