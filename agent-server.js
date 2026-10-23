import 'dotenv/config'
import express from 'express'
import { GoogleGenAI } from '@google/genai'

const app = express()
app.use(express.json())

app.post('/api/agent', async (req, res) => {
  try {
    const { task, agentName, agentRole, previousResults = [] } = req.body

    if (!task || !agentName || !agentRole) {
      return res.status(400).json({
        error: 'Task, agent name, and role are required.',
      })
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing from .env.',
      })
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
You are ${agentName} on the Singularity AI team.
Your role: ${agentRole}
Task: ${task}
Previous agents' results:
${JSON.stringify(previousResults, null, 2)}

Provide findings, recommended actions, assumptions, and risks.
Do not claim to have performed real-world actions you did not perform.
`,
    })

    res.json({ reply: response.text || 'No response returned.' })
  } catch (error) {
    console.error('Agent request failed:', error.message)
    res.status(500).json({
      error: 'The agent request failed. Check the server terminal.',
    })
  }
})

const PORT = 3001

app.listen(PORT, () => {
  console.log(`Singularity backend running at http://localhost:${PORT}`)
})
