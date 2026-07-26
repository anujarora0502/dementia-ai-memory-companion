"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus, Image as ImageIcon, Upload, Clock, Globe, Sparkles } from "lucide-react";
import "./dashboard.css";

interface Memory {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  created_at: string;
  expires_at?: string;
}

export default function CaregiverDashboard() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTemporary, setIsTemporary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [language, setLanguage] = useState("hi-IN");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.language) setLanguage(data.language);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetch("/api/memories");
      const data = await res.json();
      setMemories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
    fetchProfile();
  }, []);

  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang })
      });
    } catch (err) {
      console.error("Failed to update language:", err);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDescription) return;
    setUploading(true);

    try {
      let finalImageUrl = "";

      // Handle Image Upload via server-side API
      if (selectedFile) {
        const uploadForm = new FormData();
        uploadForm.append('file', selectedFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadForm
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          console.error("Upload failed", errData);
          alert("Failed to upload image: " + (errData.error || "Unknown error"));
          setUploading(false);
          return;
        }

        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.url;
      }

      // Calculate TTL (Expires tomorrow if temporary)
      let expiresAt = null;
      if (isTemporary) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expiresAt = tomorrow.toISOString();
      }

      // Save memory to API
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          imageUrl: finalImageUrl,
          expires_at: expiresAt
        })
      });

      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setSelectedFile(null);
        setIsTemporary(false);
        fetchMemories();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* ── Header ── */}
      <header className="dashboard-header dash-animate">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <a href="/" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
            color: '#1a1a1a', textDecoration: 'none', transition: 'all 0.3s ease'
          }}>
            <ArrowLeft size={18} />
          </a>
          <div>
            <h1>Caregiver Dashboard</h1>
            <p className="subtitle">Manage memories and preferences for Sheela.</p>
          </div>
        </div>
      </header>

      <div className="dashboard-content">

        {/* ── Add Memory Form ── */}
        <div className="dash-animate d1">
          <div className="section-title">
            <span className="accent-dot"></span>
            Add New Memory
          </div>
          <form className="form-card" onSubmit={handleAddMemory}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label>Memory Title</label>
                <input
                  type="text"
                  className="dash-input"
                  placeholder="e.g., Summer at the Lakehouse"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Description & Context</label>
                <textarea
                  className="dash-input"
                  rows={3}
                  placeholder="Provide details about the memory for the AI to understand..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Photograph</label>
                <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <div className="upload-icon-circle">
                    <Upload size={16} />
                  </div>
                  <span className="upload-label">
                    {selectedFile ? selectedFile.name : "Tap to upload a photo"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>


              <button type="submit" className="submit-btn" disabled={uploading}>
                <Plus size={18} />
                {uploading ? "Saving..." : "Add Memory"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Existing Memories ── */}
        <div className="dash-animate d2">
          <div className="section-title">
            <span className="accent-dot"></span>
            Memories ({memories.length})
          </div>

          {loading ? (
            <div className="empty-state">Loading memories...</div>
          ) : memories.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={24} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
              <p>No memories yet. Add one above!</p>
            </div>
          ) : (
            <div className="memories-scroll">
              {memories.map(memory => (
                <div key={memory.id} className="memory-card">
                  {memory.imageUrl ? (
                    <img src={memory.imageUrl} alt={memory.title} className="memory-image-thumb" />
                  ) : (
                    <div className="memory-icon-thumb">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <div className="memory-info">
                    <h3>
                      {memory.title}
                      {memory.expires_at && <span className="temp-badge">Temp</span>}
                    </h3>
                    <p>{memory.description.substring(0, 55)}...</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Preferences ── */}
        <div className="dash-animate d3">
          <div className="section-title">
            <span className="accent-dot"></span>
            AI Preferences
          </div>
          <div className="pref-card">
            <div>
              <label><Globe size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Companion Language</label>
              <select
                className="lang-select"
                value={language}
                onChange={e => handleLanguageChange(e.target.value)}
              >
                <option value="hi-IN">🇮🇳 Hindi</option>
                <option value="en-US">🇺🇸 English</option>
                <option value="gu-IN">🇮🇳 Gujarati</option>
                <option value="mr-IN">🇮🇳 Marathi</option>
                <option value="ta-IN">🇮🇳 Tamil</option>
                <option value="bn-IN">🇮🇳 Bengali</option>
              </select>
              <p className="pref-hint">The AI will instantly switch its spoken and understood language.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
