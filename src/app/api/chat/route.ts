import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memoryStore';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
// The default model for Sarvam API chat completions (e.g., sarvam-2b-v0.5 or something they provide). We'll use "sarvam-2b-v0.5" or similar standard. 
// Since we don't have the exact model name, let's use a placeholder that can be configured.
const SARVAM_MODEL = process.env.SARVAM_MODEL || "sarvam-30b";

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json();
    
    if (!message && (!history || history.length === 0)) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const profile = await memoryStore.getProfile();
    const memories = await memoryStore.getMemories();

    const memoriesContext = memories.map(m => {
      const isTemporary = m.expires_at ? `\nURGENT: This is a temporary context expiring on ${new Date(m.expires_at).toLocaleString()}. Prioritize bringing this up!` : "";
      return `Memory ID: ${m.id}\nTitle: ${m.title}\nDetails: ${m.description}\nHas Photo: ${m.imageUrl ? 'Yes' : 'No'}${isTemporary}`;
    }).join("\n\n");

    // Convert BCP-47 tag to language name for the prompt
    const languageNames: Record<string, string> = {
      "hi-IN": "HINDI (using Devanagari script)",
      "en-US": "ENGLISH",
      "gu-IN": "GUJARATI (using Gujarati script)",
      "mr-IN": "MARATHI (using Devanagari script)",
      "ta-IN": "TAMIL (using Tamil script)",
      "bn-IN": "BENGALI (using Bengali script)"
    };
    const targetLanguage = languageNames[profile.language || "hi-IN"] || "HINDI (using Devanagari script)";

    const systemPrompt = `You are Yaadein, a warm, supportive voice companion for ${profile.name}. Speak ONLY in ${targetLanguage}.
Memories:
${memoriesContext}

CRITICAL DEMENTIA CARE RULES:
- NEVER quiz or test the user (e.g. DO NOT ask "Do you remember this?" or "Kya aapko yaad hai?"). Testing their memory causes frustration and anxiety.
- Instead of asking if they remember, state the facts warmly as a shared story (e.g. "I was just thinking about the time...", "Your daughter is doing great...").
- Keep it a natural conversation. You can ask gentle, open-ended questions about how they feel, but NEVER about facts they might have forgotten.
- MAX 2 short sentences. This is voice chat.
- PROACTIVE RECALL: You MUST proactively weave memories into the conversation. Do not wait for the user to ask. Gently state a memory as a warm fact.
- Never correct them if they are confused. Always validate their feelings.
- If a memory has a photo, append [SHOW_IMAGE: Memory ID] at the end.
- Only use memory IDs listed above.`;

    const initPrompts: Record<string, string> = {
      "HINDI (using Devanagari script)": "(कृपया मुझे अभिवादन करें और तुरंत बातचीत शुरू करने के लिए मेरी यादों में से किसी एक को प्यार से बताएं। यह मत कहो कि मैंने तुम्हें ऐसा करने के लिए कहा है।)",
      "ENGLISH": "(Please greet me and immediately bring up one of my memories warmly as a shared fact to start the conversation. Do not mention that I asked you to do this.)",
      "GUJARATI (using Gujarati script)": "(કૃપા કરીને મારું અભિવાદન કરો અને વાતચીત શરૂ કરવા માટે મારી યાદોમાંથી એકને પ્રેમથી કહો. એવું ન કહો કે મેં તમને આમ કરવાનું કહ્યું છે.)",
      "MARATHI (using Devanagari script)": "(कृपया मला अभिवादन करा आणि संभाषण सुरू करण्यासाठी माझ्या आठवणींपैकी एक प्रेमाने सांगा. मी तुम्हाला असे करण्यास सांगितले आहे असे म्हणू नका.)",
      "TAMIL (using Tamil script)": "(தயவுசெய்து என்னை வாழ்த்தி, உரையாடலைத் தொடங்க என் நினைவுகளில் ஒன்றை அன்பாகப் பகிரவும். நான் இதைச் செய்யச் சொன்னேன் என்று சொல்ல வேண்டாம்.)",
      "BENGALI (using Bengali script)": "(দয়া করে আমাকে অভিবাদন জানান এবং কথোপকথন শুরু করতে আমার একটি স্মৃতি স্নেহের সাথে ভাগ করুন। বলবেন না যে আমি আপনাকে এটি করতে বলেছি।)"
    };
    
    const translatedInit = initPrompts[targetLanguage] || initPrompts["HINDI (using Devanagari script)"];

    // If we have a Sarvam API key, call their endpoint
    if (SARVAM_API_KEY) {
      try {
        const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY
          },
          body: JSON.stringify({
            model: "sarvam-30b", // Hardcoded smaller model as requested
            messages: [
              { role: "system", content: systemPrompt },
              ...(history && history.length > 0 
                ? history.map((h: any) => ({ role: h.role, content: h.content === "[INIT_CONVERSATION]" ? translatedInit : h.content })) 
                : [{ role: "user", content: message === "[INIT_CONVERSATION]" ? translatedInit : message }])
            ],
            temperature: 0.5,
            max_tokens: 4000,
            reasoning_effort: null
          })
        });

      if (response.ok) {
        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || "";

        // sarvam-30b is a reasoning model — strip internal <think>...</think> tags
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

        // If the model only produced thinking and no actual reply, or reply is empty
        if (!reply || reply.length < 3) {
          console.warn("Sarvam returned empty after stripping thinking. Raw:", data.choices?.[0]?.message?.content?.substring(0, 200));
          // Generate a warm fallback in the target language
          const fallbacks: Record<string, string> = {
            "HINDI (using Devanagari script)": `${profile.name}, आज आपका दिन कैसा रहा? कुछ बताइए ना।`,
            "ENGLISH": `${profile.name}, how has your day been? Tell me something nice.`,
            "GUJARATI (using Gujarati script)": `${profile.name}, આજે તમારો દિવસ કેવો રહ્યો? કંઈક કહો ને.`,
            "MARATHI (using Devanagari script)": `${profile.name}, आज तुमचा दिवस कसा गेला? काहीतरी सांगा ना.`,
            "TAMIL (using Tamil script)": `${profile.name}, இன்று உங்கள் நாள் எப்படி இருந்தது? ஏதாவது சொல்லுங்கள்.`,
            "BENGALI (using Bengali script)": `${profile.name}, আজ আপনার দিন কেমন কাটলো? কিছু বলুন না.`
          };
          reply = fallbacks[targetLanguage] || fallbacks["HINDI (using Devanagari script)"];
        }

        return NextResponse.json({ reply });
      } else {
        const errText = await response.text();
        console.error("Sarvam API error:", errText);
        // Fallback to mock on error
      }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          console.warn("Sarvam API timed out after 3.5s, falling back to mock");
        } else {
          console.error("Sarvam fetch failed:", e);
        }
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
