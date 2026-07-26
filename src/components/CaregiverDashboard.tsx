"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Image as ImageIcon } from "lucide-react";
import "./dashboard.css";

interface Memory {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  dateAdded: string;
}

export default function CaregiverDashboard() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

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

    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          imageUrl: newImageUrl
        })
      });

      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewImageUrl("");
        fetchMemories();
      }
    } catch (err) {
      console.error(err);
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
            <p className="subtitle">Manage memories and preferences for Eleanor.</p>
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
              <label>Photograph URL (Optional)</label>
              <div className="flex-row gap-2 items-center">
                <ImageIcon size={20} className="text-secondary" />
                <input 
                  type="url" 
                  className="glass-input w-full" 
                  placeholder="https://..."
                  value={newImageUrl}
                  onChange={e => setNewImageUrl(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="glass-button primary mt-4">
              <Plus size={20} />
              Add Memory
            </button>
          </form>
        </div>

        {/* Memories List */}
        <div className="memories-list flex-1 flex-col gap-4 animate-slide-up stagger-1">
          <h2>Existing Memories</h2>
          {loading ? (
            <p>Loading memories...</p>
          ) : (
            <div className="flex-col gap-4">
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
                    <h3>{memory.title}</h3>
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
