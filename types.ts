import * as THREE from 'three';

export interface HandMetrics {
  isOpen: boolean;
  openness: number; // 0.0 (closed) to 1.0 (fully open)
  x: number; // Normalized screen X
  y: number; // Normalized screen Y
}

export interface ParticleUniforms {
  uTime: { value: number };
  uExpansion: { value: number }; // Driven by hand openness
  uColorCore: { value: THREE.Color };
  uColorRing: { value: THREE.Color };
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}