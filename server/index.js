import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

async function gemini(prompt, asJson = false) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: asJson
          ? { responseMimeType: 'application/json', temperature: 0 }
          : { temperature: 0.5 },
      }),
    },
  )
  const d = await r.json()
  if (!r.ok) throw new Error(d.error?.message || 'Gemini error')
  return d.candidates[0].content.parts[0].text
}

// Natural language -> structured transaction
app.post('/api/parse', async (req, res) => {
  try {
    const { text, today, categories } = req.body
    const prompt = `Today is ${today}. Convert this message into a transaction.
Message: "${text}"
Return ONLY JSON: {"type":"expense|income","amount":number,"category":one of ${JSON.stringify(categories)},"note":string,"date":"YYYY-MM-DD"}
Resolve words like "yesterday" using today's date.`
    const out = JSON.parse(await gemini(prompt, true))
    // Validate: never trust model output blindly
    if (!['expense', 'income'].includes(out.type) || !(out.amount > 0) || !categories.includes(out.category)) {
      throw new Error('Could not understand that message')
    }
    res.json(out)
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// Spending data -> short advice
app.post('/api/insights', async (req, res) => {
  try {
    const prompt = `You are a friendly personal finance coach. Data (INR): ${JSON.stringify(req.body)}.
Give a 4-line summary: biggest spending area, one concern, and 2 practical saving tips. Be concise.`
    res.json({ insights: await gemini(prompt) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.listen(3001, () => console.log('API running on http://localhost:3001'))
