import { NextResponse } from 'next/server';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!SARVAM_API_KEY) {
       // Mock response for development if no key is provided
       // In a real hackathon, we need the key. For now, return an empty audio or error
       return NextResponse.json({ error: "API key missing, cannot generate voice" }, { status: 401 });
    }

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: "hi-IN",
        speaker: "meera",
        pitch: 0,
        pace: 1.05,
        loudness: 1.5,
        speech_sample_rate: 8000,
        enable_preprocessing: true,
        model: "bulbul:v1" // standard sarvam tts model
      })
    });

    if (response.ok) {
      const data = await response.json();
      // Sarvam TTS usually returns { audios: ["base64string"] } based on typical input array structure.
      // Let's assume it returns a base64 string directly or in an audios array.
      const audioBase64 = data.audios?.[0] || data.audio || null;
      
      if (audioBase64) {
         return NextResponse.json({ audio: audioBase64 });
      } else {
         return NextResponse.json({ error: "No audio in response", data }, { status: 500 });
      }
    } else {
      const errorText = await response.text();
      console.error("Sarvam TTS API error:", errorText);
      return NextResponse.json({ error: "Failed to generate speech" }, { status: response.status });
    }

  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
