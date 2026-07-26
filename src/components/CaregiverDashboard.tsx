"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Image as ImageIcon, Upload, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
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
  }, []);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDescription) return;
    setUploading(true);

    try {
      let finalImageUrl = "";

      // Handle Image Upload to Supabase Storage
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `caregiver-uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error("Upload failed", uploadError);
          alert("Failed to upload image.");
          setUploading(false);
          return;
        }

        const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
        finalImageUrl = data.publicUrl;
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
      <header className="dashboard-header glass-panel">
        <div className="flex-row items-center gap-4">
          <a href="/" className="glass-button icon-btn">
            <ArrowLeft size={24} />
          </a>
          <div>
            <h1>Caregiver Dashboard</h1>
            <p className="subtitle">Manage memories and preferences for Sheela.</p>
          </div>
        </div>
      </header>

      <div className="dashboard-content mt-8 flex-row gap-8">
        
        {/* Add Memory Form */}
        <div className="form-section flex-1 animate-slide-up">
          <form className="glass-panel flex-col gap-4" onSubmit={handleAddMemory}>
            <h2>Add New Memory</h2>
            
            <div className="flex-col gap-2">
              <label>Memory Title</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="e.g., Summer at the Lakehouse"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
              />
            </div>

            <div className="flex-col gap-2">
              <label>Description & Context</label>
              <textarea 
                className="glass-input" 
                rows={4}
                placeholder="Provide details about the memory for the AI to understand..."
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                required
              />
            </div>

            <div className="flex-col gap-2">
              <label>Upload Photograph</label>
              <div className="flex-row gap-2 items-center">
                <Upload size={20} className="text-secondary" />
                <input 
                  type="file" 
                  accept="image/*"
                  className="glass-input w-full" 
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="flex-row gap-2 items-center mt-2">
              <input 
                type="checkbox" 
                id="ttl-check"
                checked={isTemporary}
                onChange={e => setIsTemporary(e.target.checked)}
              />
              <label htmlFor="ttl-check" className="flex-row gap-1 items-center" style={{cursor: 'pointer'}}>
                <Clock size={16} /> Temporary Context (Expires in 24 hours)
              </label>
            </div>

            <button type="submit" className="glass-button primary mt-4" disabled={uploading}>
              <Plus size={20} />
              {uploading ? "Saving..." : "Add Memory"}
            </button>
          </form>
        </div>

        {/* Memories List */}
        <div className="memories-list flex-1 flex-col gap-4 animate-slide-up stagger-1">
          <h2>Existing Memories</h2>
          {loading ? (
            <p>Loading memories...</p>
          ) : (
            <div className="flex-col gap-4 memories-list-scroll">
              {memories.map(memory => (
                <div key={memory.id} className="glass-panel memory-list-item flex-row gap-4 items-center">
                  {memory.imageUrl ? (
                    <div className="thumbnail">
                      <img src={memory.imageUrl} alt={memory.title} />
                    </div>
                  ) : (
                    <div className="thumbnail placeholder">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <div className="memory-info">
                    <h3>
                      {memory.title} 
                      {memory.expires_at && <span style={{fontSize: '0.7em', marginLeft: 8, color: '#e63946'}}>(Temporary)</span>}
                    </h3>
                    <p>{memory.description.substring(0, 60)}...</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
