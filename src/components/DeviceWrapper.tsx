"use client";

import React, { useState, useEffect } from "react";
import { MockFrame } from "react-mockframe";
import "react-mockframe/styles/mockframe.css";

export default function DeviceWrapper({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      // iPhone 17 frame is roughly 900px tall with bezels
      const availableHeight = window.innerHeight;
      // Leave a tiny bit of padding (40px)
      const padding = 40;
      const targetHeight = availableHeight - padding;
      
      if (targetHeight < 900) {
        setZoom(targetHeight / 900);
      } else {
        setZoom(1);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.2s ease-in' }}>
        <MockFrame device="iPhone 17" color="black" zoom={zoom}>
          {children}
        </MockFrame>
      </div>
    </div>
  );
}
