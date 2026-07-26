"use client";

import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

function Model({ isSpeaking }: { isSpeaking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('/avatar.glb');
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // Some models have an Idle animation. Play it if it exists.
    if (actions['Idle']) {
      actions['Idle'].play();
    }
  }, [actions]);

  useFrame((state) => {
    if (!group.current) return;
    
    // Add a gentle breathing float
    group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    
    // If speaking, add some extra jitter/movement to simulate talking energy
    if (isSpeaking) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 10) * 0.05;
      group.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 15) * 0.02);
    } else {
      // Smoothly return to center
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      group.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  return (
    <group ref={group} dispose={null} position={[0, -1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function Avatar3D({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <Canvas camera={{ position: [0, 1, 5], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <directionalLight position={[-5, 5, 5]} intensity={0.5} />
        
        <Model isSpeaking={isSpeaking} />
        
        <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={10} blur={2} far={4} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/avatar.glb');
