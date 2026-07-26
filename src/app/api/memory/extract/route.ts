import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memoryStore';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel for the LLM to extract memories
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

export async function POST(request: Request) {
  try {
    const { history } = await request.json();
    
    if (!history || history.length < 2) {
      return NextResponse.json({ message: "Not enough history to extract" });
    }

    // Format chat history for the LLM
    const formattedHistory = history.map((msg: any) => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n");

    const systemPrompt = `You are a strict JSON memory extraction engine. Analyze the following conversation history and extract any NEW, permanent facts about the user's life, preferences, family, or history that were mentioned.
    
DO NOT extract transient emotions (like "User is happy today").
DO NOT extract facts the assistant already brought up from its own memory.
Only extract facts the USER explicitly shared in this specific conversation.

Respond ONLY with a valid JSON array of objects. Each object must have:
- "title": A short 3-5 word summary (e.g. "Daughter's name")
- "description": The full fact (e.g. "The user's daughter is named Sarah and she lives in London.")

If there are no new facts, output an empty JSON array: []

Do not output ANY text outside of the JSON array. No greetings, no explanations.

Conversation History:
${formattedHistory}`;

    if (!SARVAM_API_KEY) {
      return NextResponse.json({ message: "No API key" });
    }

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY
      },
      body: JSON.stringify({
        model: "sarvam-30b",
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (response.ok) {
      const data = await response.json();
      let reply = data.choices?.[0]?.message?.content || "";
      
      // Strip reasoning tags if present
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      // Extract JSON if wrapped in backticks
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        reply = jsonMatch[0];
      }

      try {
        const extractedMemories = JSON.parse(reply);
        if (Array.isArray(extractedMemories) && extractedMemories.length > 0) {
          let count = 0;
          for (const mem of extractedMemories) {
            if (mem.title && mem.description) {
              await memoryStore.addMemory({
                title: mem.title,
                description: mem.description
              });
              count++;
            }
          }
          return NextResponse.json({ success: true, count });
        }
      } catch (parseError) {
        console.error("Failed to parse extracted memory JSON:", reply);
      }
    }

    return NextResponse.json({ success: true, count: 0 });
  } catch (error) {
    console.error("Auto-memory extraction error:", error);
    return NextResponse.json({ error: "Failed to extract memory" }, { status: 500 });
  }
}
