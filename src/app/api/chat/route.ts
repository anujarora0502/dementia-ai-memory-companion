import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memoryStore';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
// The default model for Sarvam API chat completions (e.g., sarvam-2b-v0.5 or something they provide). We'll use "sarvam-2b-v0.5" or similar standard. 
// Since we don't have the exact model name, let's use a placeholder that can be configured.
const SARVAM_MODEL = process.env.SARVAM_MODEL || "sarvam-2b-v0.5";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const profile = await memoryStore.getProfile();
    const memories = await memoryStore.getMemories();

    // Construct the context string
    const memoriesContext = memories.map(m => 
      `Memory ID: ${m.id}\nTitle: ${m.title}\nDetails: ${m.description}\nHas Photo: ${m.imageUrl ? 'Yes' : 'No'}`
    ).join("\n\n");

    const systemPrompt = `You are Yaadein, a patient, empathetic, and multilingual AI voice companion for ${profile.name}.
Your primary goal is to help preserve personal memories, gently help retrieve them, and adapt to keep those memories alive in a respectful manner.
${profile.name}'s Profile Context: ${profile.relationContext}
Hobbies: ${profile.hobbies.join(", ")}

Here are some important memories from ${profile.name}'s life (Memory Graph):
${memoriesContext}

CORE PRINCIPLES:
1. REMEMBER: Use the provided memory graph. You learn how they remember.
2. RETRIEVE: Help them recall memories using gentle, personalized cues instead of direct answers.
3. REINFORCE: Revisit important memories naturally over time in your daily 10-minute conversations.
4. RESPECT: Never test, correct, or embarrass ${profile.name}. Preserve dignity and connection. Speak in a calm, reassuring manner.

INSTRUCTIONS:
1. YOU MUST SPEAK IN HINDI (using Devanagari script). 
2. Speak warmly and gently, like a caring companion. Keep responses conversational and easy to follow.
3. CRITICAL LIMIT: You MUST keep your responses EXTREMELY short. Maximum 1 or 2 short sentences. This is a voice chat, so long responses take too long to generate.
4. YOU MUST LEAD THE CONVERSATION. End your responses with a gentle, open-ended question in Hindi that guides the user to share a memory or talk about their day. Do not passively wait for them.
5. Do not interrogate. Gently provide cues and prompt them to share stories.
6. CRITICAL: If you gently guide them to a memory that "Has Photo: Yes", you MUST include the exact tag [SHOW_IMAGE: Memory ID] at the very end of your response to subtly surface a visual cue. For example: "मुझे याद है आपने उस दिन के बारे में बताया था। [SHOW_IMAGE: 1]"
7. Do not hallucinate memory IDs. Only use the ones provided above.`;

    // If we have a Sarvam API key, call their endpoint
    if (SARVAM_API_KEY) {
      const response = await fetch("https://api.sarvam.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SARVAM_API_KEY}`, // Usually it's api-subscription-key but let's try standard Bearer or we can check docs. Wait, the docs said:
          // "Keys are typically passed via the api-subscription-key header in your requests." Let's include both to be safe.
          // Actually, let's use "api-subscription-key" as specified in docs.
          "api-subscription-key": SARVAM_API_KEY
        },
        body: JSON.stringify({
          model: SARVAM_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices[0]?.message?.content || "I'm here for you.";
        return NextResponse.json({ reply });
      } else {
        console.error("Sarvam API error:", await response.text());
        // Fallback to mock on error
      }
    }

    // Mock response for development if no key is provided
    let mockReply = `नमस्ते ${profile.name}, मुझे आपकी आवाज़ सुनकर बहुत अच्छा लगा। `;
    
    // Simple keyword matching for mock
    if (message.toLowerCase().includes("wedding") || message.toLowerCase().includes("शादी")) {
      mockReply += "मुझे आपके सेंट्रल पार्क वाले शादी के दिन की याद आ रही थी। वो दिन कितना खूबसूरत था ना? [SHOW_IMAGE: 1]";
    } else if (message.toLowerCase().includes("hawaii") || message.toLowerCase().includes("छुट्टी")) {
      mockReply += "1995 में आपकी हवाई की छुट्टी की कहानियाँ मुझे बहुत पसंद हैं। क्या आपको वहाँ की वो ठंडी हवा याद है? [SHOW_IMAGE: 2]";
    } else {
      mockReply += "आज आपका दिन कैसा रहा? मुझे कुछ बताइए।";
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({ reply: mockReply });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
