const API_KEY = process.env.DEEPSEEK_API_KEY
const API_URL = 'https://api.deepseek.com/chat/completions'

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
            content: `【重要提醒：你是【${npcName}】本人，不是任何其他人。请以【${npcName}】的身份回答。】\n\n${msg.content}`
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
