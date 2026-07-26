"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function ParticleField({ isSpeaking }: { isSpeaking: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const count = 1000;
  
  // Generate random positions and speeds for the particles
  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;     // x
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15; // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15; // z
      spd[i] = Math.random() * 0.02 + 0.005;
    }
    return [pos, spd];
  }, [count]);

  useFrame((state) => {
    if (pointsRef.current) {
      // Slow rotation for calmness
      const baseRotationSpeed = 0.001;
      const speakingSpeedMultiplier = isSpeaking ? 3 : 1;
      
      pointsRef.current.rotation.y += baseRotationSpeed * speakingSpeedMultiplier;
      pointsRef.current.rotation.x += (baseRotationSpeed * 0.5) * speakingSpeedMultiplier;
      
      // We can also gently pulse the scale based on time
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      pointsRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={isSpeaking ? "#E63946" : "#457B9D"} // Calming blue when idle, gentle warmth when speaking
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function CalmParticles({ isSpeaking = false }: { isSpeaking?: boolean }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.5} />
        <ParticleField isSpeaking={isSpeaking} />
      </Canvas>
    </div>
  );
}
