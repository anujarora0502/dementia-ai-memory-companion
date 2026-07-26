"use client";

import React from "react";
import "./ambient.css";

interface AmbientGlowProps {
  state: "idle" | "listening" | "thinking" | "speaking";
}

export default function AmbientGlow({ state }: AmbientGlowProps) {
  return (
    <div className={`ambient-container ambient-${state}`}>
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <div className="ambient-orb orb-3" />
    </div>
  );
}
