import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- SHADERS ---

const vertexShader = `
  uniform float uTime;
  uniform float uExpansion; // 0.0 (far/small) to 1.0 (close/chaos)
  
  attribute float size;
  attribute float speed;
  attribute float orbitRadius;
  attribute float angleOffset;
  attribute float randomness;
  attribute vec3 color;
  
  varying vec3 vColor;
  varying float vExpansion;

  // Pseudo-random function
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  // Simplex noise-like wobble
  vec3 noiseVec(float t, float idx) {
    return vec3(
      sin(t * 10.0 + idx),
      cos(t * 12.0 + idx * 2.0),
      sin(t * 8.0 + idx * 3.0)
    );
  }

  void main() {
    vColor = color;
    vExpansion = uExpansion;

    // --- KEPLERIAN PHYSICS ---
    // Angular velocity is proportional to 1 / sqrt(r^3) -> Simplified to 1/r for visuals
    float orbitSpeed = speed / sqrt(orbitRadius + 0.1); 
    float currentAngle = angleOffset + (orbitSpeed * uTime * 0.5);

    // Standard Orbital Position
    float x = cos(currentAngle) * orbitRadius;
    float z = sin(currentAngle) * orbitRadius;
    float y = sin(currentAngle * 2.0 + angleOffset) * (0.1 * orbitRadius); // Slight orbital inclination w/ wave

    vec3 orbitalPos = vec3(x, y, z);

    // --- CHAOS / EXPLOSION ---
    // When uExpansion > 0.8, particles start vibrating and breaking orbit
    // The "Fly" or "Brownian" effect
    
    float chaosThreshold = 0.7;
    float chaosFactor = smoothstep(chaosThreshold, 1.0, uExpansion);
    
    // Create high frequency jitter
    vec3 chaosPos = orbitalPos + (noiseVec(uTime, randomness) * (uExpansion * 3.0));
    
    // Mix based on chaos factor. 
    // We also "zoom" the position towards the camera (Z axis mostly) as expansion increases
    vec3 finalPos = mix(orbitalPos, chaosPos, chaosFactor);

    // Apply scaling/zooming logic
    // As expansion increases, the whole system scales UP (simulating getting closer)
    float systemScale = 1.0 + (uExpansion * 5.0); 
    
    vec4 mvPosition = modelViewMatrix * vec4(finalPos * systemScale, 1.0);

    // Size Attenuation
    // Brightness/Size logic: Small/Far = Dim. Large/Close = Bright.
    // uExpansion maps 0->1. 
    float baseSize = size * (1.0 + uExpansion * 2.0); // Grow physically
    
    gl_PointSize = baseSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vExpansion;

  void main() {
    // Circular particle
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft edge
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

    // Brightness Logic
    // Low expansion = Dimmer (0.4 brightness)
    // High expansion = Brighter (up to 2.0 brightness for bloom)
    float brightness = 0.6 + (vExpansion * 2.0);

    // Add a hot core effect when chaos is high
    vec3 finalColor = vColor * brightness;
    
    // If very chaotic/close, flash slightly white
    if (vExpansion > 0.9) {
      finalColor = mix(finalColor, vec3(1.0), 0.2);
    }

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface SaturnParticlesProps {
  openness: number; // 0 to 1
}

export const SaturnParticles: React.FC<SaturnParticlesProps> = ({ openness }) => {
  const meshRef = useRef<THREE.Points>(null);
  
  // Particle count
  const COUNT = 15000;
  
  // Memoize geometry generation
  const { positions, colors, sizes, speeds, radii, offsets, randomness } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const sz = new Float32Array(COUNT);
    const spd = new Float32Array(COUNT);
    const rad = new Float32Array(COUNT);
    const off = new Float32Array(COUNT);
    const rnd = new Float32Array(COUNT);

    const colorCore = new THREE.Color('#ffaa33'); // Saturn Gold/Orange
    const colorRingInner = new THREE.Color('#dcb18c');
    const colorRingOuter = new THREE.Color('#8e8090');

    for (let i = 0; i < COUNT; i++) {
      // Distribution: 20% Core, 80% Rings
      const isCore = i < COUNT * 0.2;
      
      let r, g, b, radius, speedVal, sizeVal;

      if (isCore) {
        // Sphere distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const coreRad = Math.random() * 2.5; // Core radius
        
        // Convert spherical to cartesian for initial bake (though shader handles movement)
        // We actually store "Radius" as distance from center for the ring logic, 
        // but for core we treat them as fixed relative bodies initially.
        // To simplify the shader, we simulate core as rings with very randomized inclination?
        // No, let's treat them as valid orbital mechanics but with small radius.
        
        radius = coreRad; 
        speedVal = 0.5 + Math.random() * 0.5;
        sizeVal = Math.random() * 0.5 + 0.5;
        
        colorCore.toArray(col, i * 3);
      } else {
        // Ring distribution (Gaussian-ish bands)
        const band = Math.random();
        // Gaps in rings (Cassini division-ish)
        let ringRad;
        if (band < 0.3) ringRad = 4.0 + Math.random() * 2.0; // B Ring
        else if (band < 0.4) ringRad = 6.5 + Math.random() * 0.5; // Gap (empty-ish, few particles)
        else ringRad = 7.0 + Math.random() * 3.0; // A Ring

        radius = ringRad;
        speedVal = 2.0; // Base speed factor (modified by shader 1/sqrt(r))
        sizeVal = Math.random() * 0.3 + 0.2;

        const mixedColor = new THREE.Color().lerpColors(colorRingInner, colorRingOuter, (radius - 4.0) / 6.0);
        mixedColor.toArray(col, i * 3);
      }

      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      sz[i] = sizeVal;
      spd[i] = speedVal;
      rad[i] = radius;
      off[i] = Math.random() * Math.PI * 2;
      rnd[i] = Math.random();
    }

    return { 
      positions: pos, 
      colors: col, 
      sizes: sz, 
      speeds: spd, 
      radii: rad, 
      offsets: off, 
      randomness: rnd 
    };
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExpansion: { value: 0 },
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Update Time
    uniforms.uTime.value = state.clock.getElapsedTime();

    // Smoothly interpolate expansion factor (Lerp) for fluid visuals
    // This removes jitter from hand detection
    const targetExpansion = openness;
    uniforms.uExpansion.value = THREE.MathUtils.lerp(
      uniforms.uExpansion.value, 
      targetExpansion, 
      0.1 // Smoothing factor
    );
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-speed" count={speeds.length} array={speeds} itemSize={1} />
        <bufferAttribute attach="attributes-orbitRadius" count={radii.length} array={radii} itemSize={1} />
        <bufferAttribute attach="attributes-angleOffset" count={offsets.length} array={offsets} itemSize={1} />
        <bufferAttribute attach="attributes-randomness" count={randomness.length} array={randomness} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};