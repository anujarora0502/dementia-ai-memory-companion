"use client";

import React, { useState, useEffect } from "react";
import { MockFrame } from "react-mockframe";
import "react-mockframe/styles/mockframe.css";

export default function DeviceWrapper({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      
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

  if (!mounted) {
    return <div style={{ opacity: 0, width: '100vw', height: '100vh' }}>{children}</div>;
  }

  if (isMobile) {
    return (
      <div style={{ width: '100%', height: '100dvh', backgroundColor: '#fcf8f9', overflow: 'hidden' }}>
        {children}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ opacity: 1, transition: 'opacity 0.2s ease-in' }}>
        <MockFrame device="iPhone 17" color="black" zoom={zoom}>
          {children}
        </MockFrame>
      </div>
    </div>
  );
}
