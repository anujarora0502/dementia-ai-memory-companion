"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Settings } from "lucide-react";
import "./chat.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageTitle?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "नमस्ते शीला, आप कैसे हैं? आज आपने क्या किया?" }
  ]);
  const [orbState, setOrbState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use a ref to store the latest transcript so we don't have stale closures in the onend callback
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = liveTranscript;
  }, [liveTranscript]);

  // Initialize Speech Recognition once
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN";
      recognition.continuous = false; // Stop automatically when user pauses
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        setLiveTranscript(finalTranscript || interimTranscript);
      };

      recognition.onend = () => {
        // When speech recognition ends (either manually or by timeout)
        const finalString = transcriptRef.current.trim();
        
        if (finalString) {
          // We have a transcript, send it!
          setOrbState("thinking");
          handleSend(finalString);
          setLiveTranscript("");
        } else {
          // No transcript, go back to idle
          setOrbState("idle");
        }
      };

      recognition.onerror = (e: any) => {
        console.error("Speech recognition error", e.error);
        setOrbState("idle");
        setLiveTranscript("");
      };

      recognitionRef.current = recognition;
    }
    
    // Cleanup if component unmounts
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // Empty dependency array, run once!

  const toggleListening = () => {
    if (orbState === "idle" || orbState === "speaking") {
      // Stop speaking if currently speaking
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      setOrbState("listening");
      setLiveTranscript("");
      
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error("Already started", e);
      }
    } else if (orbState === "listening") {
      // Manually stopping it
      recognitionRef.current?.stop();
    }
  };

  const playTTS = async (textToSpeak: string) => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak })
      });
      
      const data = await response.json();
      if (data.audio) {
        const audioUrl = `data:audio/wav;base64,${data.audio}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setOrbState("idle");
        };
        
        setOrbState("speaking");
        audio.play();
      } else {
        setOrbState("idle");
      }
    } catch (e) {
      console.error("TTS failed", e);
      setOrbState("idle");
    }
  };

  // We need handleSend defined before useEffect if it was used in useEffect, 
  // but it's used inside the closure of onend, which is fine as long as we use a ref or closure captures it.
  // Actually, handleSend being re-created every render might be an issue inside the onend closure from the initial render!
  // Let's use a ref for handleSend to avoid stale closures in the initial useEffect!

  const handleSendRef = useRef<((msg: string) => void) | null>(null);
  
  handleSendRef.current = async (userMessage: string) => {
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage })
      });
      
      const data = await response.json();
      
      if (data.reply) {
        let replyContent = data.reply;
        let imageUrl: string | undefined;
        let imageTitle: string | undefined;
        
        const imageMatch = replyContent.match(/\[SHOW_IMAGE:\s*([a-zA-Z0-9_-]+)\]/);
        
        if (imageMatch) {
          const memoryId = imageMatch[1];
          replyContent = replyContent.replace(imageMatch[0], "").trim();
          
          try {
            const memoryRes = await fetch(`/api/memories/${memoryId}`);
            if (memoryRes.ok) {
              const memoryData = await memoryRes.json();
              if (memoryData.imageUrl) {
                imageUrl = memoryData.imageUrl;
                imageTitle = memoryData.title;
              }
            }
          } catch (err) {
            console.error("Failed to load memory image", err);
          }
        }
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: replyContent,
          imageUrl,
          imageTitle
        }]);

        // Speak the clean text
        await playTTS(replyContent);
      } else {
        setOrbState("idle");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setOrbState("idle");
    }
  };

  const handleSend = (msg: string) => {
    if (handleSendRef.current) {
      handleSendRef.current(msg);
    }
  };

  const latestMessage = messages[messages.length - 1];

  return (
    <div className="chat-container">
      <header className="chat-header">
        <a href="/caregiver" className="icon-btn" style={{color: 'var(--text-secondary)'}}>
          <Settings size={24} />
        </a>
        <div className="chat-intro-notice">
          <p>Yaadein</p>
        </div>
        <div style={{width: 24}}></div>
      </header>

      <div className="voice-interface-main">
        <div className="transcript-area">
          {latestMessage && latestMessage.role === "assistant" && (
            <div className="message-bubble assistant animate-slide-up">
              {latestMessage.content}
            </div>
          )}
          
          {latestMessage && latestMessage.role === "assistant" && latestMessage.imageUrl && (
            <div className="subtle-image-reveal">
              <img src={latestMessage.imageUrl} alt={latestMessage.imageTitle || "Memory"} />
            </div>
          )}
          
          {latestMessage && latestMessage.role === "user" && (
            <div className="message-bubble user animate-slide-up">
              {latestMessage.content}
            </div>
          )}
        </div>

        <div className={`orb-container orb-state-${orbState}`}>
          {orbState === "listening" && (
            <>
              <div className="orb-ripple"></div>
              <div className="orb-ripple"></div>
            </>
          )}
          {orbState === "speaking" && (
            <>
              <div className="orb-ripple"></div>
              <div className="orb-ripple"></div>
            </>
          )}
          
          <div className="voice-orb" onClick={toggleListening}>
            {orbState === "listening" ? (
               <MicOff size={40} className="orb-icon" />
            ) : (
               <Mic size={40} className="orb-icon" />
            )}
          </div>
          
          <div className="orb-status-text">
            {orbState === "idle" && "Tap to Speak"}
            {orbState === "listening" && "Listening..."}
            {orbState === "thinking" && "Thinking..."}
            {orbState === "speaking" && "Speaking..."}
          </div>
          
          {liveTranscript && (
            <div className="live-transcript">
              {liveTranscript}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
