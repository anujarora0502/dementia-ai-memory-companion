"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Settings, Square } from "lucide-react";
import AmbientGlow from "./AmbientGlow";
import "./chat.css";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  imageTitle?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [currentImage, setCurrentImage] = useState<{url: string, title: string} | null>(null);
  const [orbState, setOrbState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [profileLang, setProfileLang] = useState("hi-IN");

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(data => {
        if (data.language) setProfileLang(data.language);
      })
      .catch(err => console.error(err));
  }, []);
  
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
        if (e.error === 'no-speech' && isConversationActiveRef.current) {
          // Just ignore no-speech and let it restart via onend silently
        } else {
          console.error("Speech recognition error", e.error);
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

  // Update language when profileLang changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = profileLang;
    }
  }, [profileLang]);

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

  const playTTS = async (textToSpeak: string, imageUrl?: string, imageTitle?: string) => {
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
        // Synchronize subtitle appearance with audio playback!
        setCurrentSubtitle(textToSpeak);
        if (imageUrl) {
          setCurrentImage({ url: imageUrl, title: imageTitle || "" });
        } else {
          setCurrentImage(null);
        }
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
    const newMessage = { role: "user" as const, content: userMessage };
    const chatHistory = [...messages, newMessage];
    
    setMessages(chatHistory);
    setCurrentSubtitle(userMessage); // Show the user's message immediately while thinking
    setCurrentImage(null);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: chatHistory })
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
                setCurrentImage({ url: imageUrl as string, title: imageTitle || "" });
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

        // Speak the clean text and synchronize subtitle appearance
        if (isConversationActiveRef.current) {
          await playTTS(replyContent, imageUrl, imageTitle);
        } else {
          // If conversation is manually paused/stopped, just show it
          setCurrentSubtitle(replyContent);
          if (imageUrl) setCurrentImage({ url: imageUrl, title: imageTitle || "" });
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
      
      {/* Ambient Glow Background */}
      <AmbientGlow state={orbState} />

      <header className="chat-header" style={{ position: 'relative', zIndex: 10 }}>
        {/* Placeholder to keep logo centered (matches width of the 24px placeholder on the right) */}
        <div style={{width: 44}}></div>
        <div className="chat-intro-notice">
          <img src="/logo.png" alt="Yaadein" className="header-logo" />
        </div>
        <div style={{width: 44}}></div>
      </header>

      <div className="voice-interface-main" style={{ position: 'relative', zIndex: 10 }}>
        <div className="transcript-area">
          {currentSubtitle && (
            <div className="cinematic-subtitle animate-slide-up" key={currentSubtitle}>
              {currentSubtitle}
            </div>
          )}
          
          {currentImage && (
            <div className="cinematic-image">
              <img src={currentImage.url} alt={currentImage.title} />
            </div>
          )}
        </div>

        {/* Minimal Control Bar */}
        <div className="subtle-controls flex-col items-center gap-2 mt-8">
          {liveTranscript && (
            <div className="live-transcript" style={{ marginBottom: '1rem' }}>
              {liveTranscript}
            </div>
          )}
          
          <div className="orb-status-text" style={{ marginBottom: '0.5rem' }}>
            {orbState === "idle" && "Tap to start conversation"}
            {orbState === "listening" && "Listening..."}
            {orbState === "thinking" && "Thinking..."}
            {orbState === "speaking" && "Speaking..."}
          </div>

          <button 
            onClick={toggleConversation}
            className="glass-button"
            style={{
              padding: isConversationActive ? '0' : '1rem',
              background: 'transparent',
              border: 'none',
              color: '#1a1a1a',
              outline: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px'
            }}
          >
            {isConversationActive ? (
              <div className="mic-active-ring" />
            ) : (
              <Mic size={32} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
