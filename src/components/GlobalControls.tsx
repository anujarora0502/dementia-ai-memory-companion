"use client";

import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, Settings } from 'lucide-react';
import Link from 'next/link';

export default function GlobalControls() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const buttonStyle = {
    background: 'rgba(20, 20, 20, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: '12px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transition: 'all 0.2s ease-in-out',
    textDecoration: 'none'
  };
  return (
    <>
      <style>
        {`
          @media (max-width: 768px) {
            .global-controls-container {
              display: none !important;
            }
          }
        `}
      </style>
      <div className="global-controls-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', gap: '12px' }}>
        <Link 
          href="/caregiver"
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(40, 40, 40, 0.9)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(20, 20, 20, 0.8)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Settings & Dashboard"
        >
          <Settings size={20} />
        </Link>
        
        <button
          onClick={toggleFullscreen}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(40, 40, 40, 0.9)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(20, 20, 20, 0.8)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </>
  );
}
