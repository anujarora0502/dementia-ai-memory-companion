"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Settings, Square } from "lucide-react";
import CalmParticles from "./CalmParticles";
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
  const [isConversationActive, setIsConversationActive] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const transcriptRef = useRef("");
  const isConversationActiveRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = liveTranscript;
  }, [liveTranscript]);

  useEffect(() => {
    isConversationActiveRef.current = isConversationActive;
  }, [isConversationActive]);

  // Initialize Speech Recognition once
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN";
      recognition.continuous = false; // We manage the continuous loop manually for better control
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
        const finalString = transcriptRef.current.trim();
        
        if (finalString) {
          // Send transcript to AI
          setOrbState("thinking");
          handleSend(finalString);
          setLiveTranscript("");
        } else {
          // If no transcript was captured and the conversation is still active, just restart listening
          if (isConversationActiveRef.current && orbState !== "thinking" && orbState !== "speaking") {
            try {
              recognitionRef.current?.start();
            } catch(e) {}
          } else if (!isConversationActiveRef.current) {
            setOrbState("idle");
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.error("Speech recognition error", e.error);
        if (e.error === 'no-speech' && isConversationActiveRef.current) {
          // Just ignore no-speech and let it restart via onend
        } else {
          setIsConversationActive(false);
          setOrbState("idle");
        }
        setLiveTranscript("");
      };

      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []); // Run once

  const toggleConversation = () => {
    if (!isConversationActive) {
      // Start the conversation loop
      setIsConversationActive(true);
      setOrbState("listening");
      setLiveTranscript("");
      try {
        recognitionRef.current?.start();
      } catch (e) {}
    } else {
      // Stop the conversation completely
      setIsConversationActive(false);
      setOrbState("idle");
      recognitionRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
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
          if (isConversationActiveRef.current) {
            // Resume listening automatically after AI finishes speaking
            setOrbState("listening");
            try {
              recognitionRef.current?.start();
            } catch (e) {}
          } else {
            setOrbState("idle");
          }
        };
        
        setOrbState("speaking");
        audio.play();
      } else {
        if (isConversationActiveRef.current) {
           setOrbState("listening");
           recognitionRef.current?.start();
        } else {
           setOrbState("idle");
        }
      }
    } catch (e) {
      console.error("TTS failed", e);
      if (isConversationActiveRef.current) {
        setOrbState("listening");
        recognitionRef.current?.start();
      } else {
        setOrbState("idle");
      }
    }
  };

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
          } catch (err) {}
        }
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: replyContent,
          imageUrl,
          imageTitle
        }]);

        // Speak the clean text
        if (isConversationActiveRef.current) {
          await playTTS(replyContent);
        }
      } else {
        if (isConversationActiveRef.current) {
          setOrbState("listening");
          recognitionRef.current?.start();
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      if (isConversationActiveRef.current) {
        setOrbState("listening");
        recognitionRef.current?.start();
      }
    }
  };

  const handleSend = (msg: string) => {
    if (handleSendRef.current) handleSendRef.current(msg);
  };

  const latestMessage = messages[messages.length - 1];

  return (
    <div className="chat-container" style={{ position: 'relative', overflow: 'hidden' }}>
      
      {/* 3D Calm Particle Background */}
      <CalmParticles isSpeaking={orbState === "speaking"} />

      <header className="chat-header" style={{ position: 'relative', zIndex: 10 }}>
        <a href="/caregiver" className="icon-btn" style={{color: 'var(--text-secondary)'}}>
          <Settings size={24} />
        </a>
        <div className="chat-intro-notice">
          <p>Yaadein</p>
        </div>
        <div style={{width: 24}}></div>
      </header>

      <div className="voice-interface-main" style={{ position: 'relative', zIndex: 10 }}>
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

        {/* Minimal Control Bar */}
        <div className="subtle-controls flex-col items-center gap-2 mt-8">
          {liveTranscript && (
            <div className="live-transcript" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.2)' }}>
              {liveTranscript}
            </div>
          )}
          
          <div className="orb-status-text" style={{ marginBottom: '0.5rem', opacity: 0.8 }}>
            {orbState === "idle" && "Tap to start conversation"}
            {orbState === "listening" && "Listening..."}
            {orbState === "thinking" && "Thinking..."}
            {orbState === "speaking" && "Speaking..."}
          </div>

          <button 
            onClick={toggleConversation}
            className="glass-button"
            style={{
              padding: '1rem',
              borderRadius: '50%',
              background: isConversationActive ? 'rgba(230, 57, 70, 0.2)' : 'rgba(255,255,255,0.3)',
              border: `1px solid ${isConversationActive ? 'rgba(230, 57, 70, 0.5)' : 'rgba(255,255,255,0.5)'}`,
              color: isConversationActive ? '#E63946' : 'var(--text-primary)'
            }}
          >
            {isConversationActive ? <Square size={24} fill="currentColor" /> : <Mic size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
}
