import * as THREE from 'three';

/**
 * Procedural PBR texture generators for the Calzado Chapín virtual tour.
 * Generates canvas-based textures in memory for zero-network-payload photorealism:
 * - Traditional Guatemalan Mayan woven textile + weave normal map
 * - Polished epoxy concrete floor with expansion joints + normal map
 * - Warm teak/cedar wood grain + normal map
 * - Brushed steel micro-scratch normal map
 * - Ergonomic natural rubber sole tread normal map
 * - Technical graduated serigraphy for 3D shoe lasts
 */

/** Helper: create a 2D canvas with standard pixel context */
function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[factory] Unable to acquire 2D canvas context');
  return { canvas, ctx };
}

/** 1. Authentic Guatemalan woven textile (patrón típico maya) */
export function createGuatemalanTextileTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(512, 512);

  // Base background: organic unbleached cotton
  ctx.fillStyle = '#ece5d8';
  ctx.fillRect(0, 0, 512, 512);

  // Traditional Guatemalan vibrant band palette (Sololá / Totonicapán style)
  const bands = [
    { y: 0, h: 48, color: '#162238' }, // Deep indigo
    { y: 48, h: 24, color: '#b93826' }, // Crimson cochineal
    { y: 72, h: 16, color: '#d89b28' }, // Marigold gold
    { y: 88, h: 56, color: '#0e6955' }, // Quetzal jade green
    { y: 144, h: 20, color: '#ece5d8' }, // Raw cotton
    { y: 164, h: 64, color: '#882233' }, // Mayan red
    { y: 228, h: 28, color: '#1a3344' }, // Midnight teal
    { y: 256, h: 48, color: '#162238' }, // Mirror symmetry repeat
    { y: 304, h: 24, color: '#b93826' },
    { y: 328, h: 16, color: '#d89b28' },
    { y: 344, h: 56, color: '#0e6955' },
    { y: 400, h: 20, color: '#ece5d8' },
    { y: 420, h: 64, color: '#882233' },
    { y: 484, h: 28, color: '#1a3344' },
  ];

  for (const b of bands) {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, b.y, 512, b.h);
  }

  // Draw traditional geometric diamond / zigzag brocade motifs (figuras de telar)
  const drawDiamonds = (centerY: number, size: number, color: string, step: number) => {
    ctx.fillStyle = color;
    for (let x = 0; x <= 512; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, centerY - size);
      ctx.lineTo(x + size, centerY);
      ctx.lineTo(x, centerY + size);
      ctx.lineTo(x - size, centerY);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Center diamond rows
  drawDiamonds(116, 14, '#f2ebe0', 40);
  drawDiamonds(116, 8, '#d89b28', 40);
  drawDiamonds(196, 18, '#0e6955', 48);
  drawDiamonds(196, 10, '#f2ebe0', 48);
  drawDiamonds(372, 14, '#f2ebe0', 40);
  drawDiamonds(372, 8, '#d89b28', 40);
  drawDiamonds(452, 18, '#0e6955', 48);
  drawDiamonds(452, 10, '#f2ebe0', 48);

  // Micro-weave crosshatch overlay: physical weft & warp thread simulation
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < 512; y += 4) {
    ctx.fillRect(0, y, 512, 1.5);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let x = 0; x < 512; x += 4) {
    ctx.fillRect(x, 0, 1.5, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(2, 2);
  texture.needsUpdate = true;
  return texture;
}

/** Normal map for woven textile threads */
export function createGuatemalanTextileNormalMap(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(256, 256);
  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      // Weave thread bumps (sinusoidal pattern in both directions)
      const wx = Math.sin((x / 4) * Math.PI * 2);
      const wy = Math.sin((y / 4) * Math.PI * 2);
      const nx = wx * 0.35;
      const ny = wy * 0.35;

      // Encode normal [-1, 1] to RGB [0, 255]
      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;
  return texture;
}

/** 2. Polished epoxy concrete floor texture with clean expansion joints */
export function createPolishedEpoxyFloorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(512, 512);

  // Smooth warm cleanroom concrete
  ctx.fillStyle = '#eae7e1';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-mottling / aggregate specks
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Clean architectural expansion joint lines (clean-tech bay grid)
  ctx.strokeStyle = '#c5c0b6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();

  // Subtle chamfered edge on joints
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 258);
  ctx.lineTo(512, 258);
  ctx.moveTo(258, 0);
  ctx.lineTo(258, 512);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(6, 4);
  texture.needsUpdate = true;
  return texture;
}

/** Floor normal map for expansion joints and micro-flatness */
export function createFloorNormalMap(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(256, 256);
  ctx.fillStyle = '#8080ff'; // Flat normal
  ctx.fillRect(0, 0, 256, 256);

  // Joint indentation in normal map
  ctx.strokeStyle = '#7070ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.needsUpdate = true;
  return texture;
}

/** 3. Warm Teak / Conacaste wood grain texture */
export function createWoodTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(512, 512);

  // Honey teak base
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#b8844e');
  grad.addColorStop(0.3, '#c5925a');
  grad.addColorStop(0.7, '#af7a44');
  grad.addColorStop(1, '#be8c52');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Annual growth rings / organic grain lines
  ctx.strokeStyle = 'rgba(92, 53, 21, 0.22)';
  for (let i = 0; i < 40; i++) {
    const y = i * 13 + (Math.random() - 0.5) * 6;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      150,
      y + Math.sin(i * 0.8) * 16,
      350,
      y - Math.cos(i * 0.6) * 14,
      512,
      y + (Math.random() - 0.5) * 8,
    );
    ctx.stroke();
  }

  // Fine longitudinal pores
  ctx.fillStyle = 'rgba(70, 38, 14, 0.08)';
  for (let i = 0; i < 2000; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const len = 4 + Math.random() * 12;
    ctx.fillRect(px, py, len, 0.8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(2, 1);
  texture.needsUpdate = true;
  return texture;
}

/** 4. Brushed steel anisotropic micro-scratches normal map */
export function createBrushedSteelNormalMap(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(256, 256);
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;

  // Horizontal brushed scratches
  for (let y = 0; y < 256; y++) {
    const lineNoise = (Math.random() - 0.5) * 28;
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4;
      const grain = lineNoise + (Math.random() - 0.5) * 6;
      data[idx] = 128; // X normal unchanged
      data[idx + 1] = Math.min(255, Math.max(0, 128 + grain)); // Y deflection
      data[idx + 2] = 255; // Z upward
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

/** 5. Natural rubber sole tread grip normal map */
export function createRubberSoleNormalMap(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(256, 256);
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 256);

  // Ergonomic micro-diamond grip tread pattern
  ctx.strokeStyle = '#6868ff';
  ctx.lineWidth = 2.5;
  const step = 16;
  for (let x = 0; x <= 256; x += step) {
    for (let y = 0; y <= 256; y += step) {
      ctx.beginPath();
      ctx.moveTo(x + step / 2, y);
      ctx.lineTo(x + step, y + step / 2);
      ctx.lineTo(x + step / 2, y + step);
      ctx.lineTo(x, y + step / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 8);
  texture.needsUpdate = true;
  return texture;
}

/** 6. Technical serigraphy texture for 3D ergonomic lasts (jade polymer) */
export function createLastTechnicalTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(512, 512);

  // Translucent Jade base
  ctx.fillStyle = '#0f7d67';
  ctx.fillRect(0, 0, 512, 512);

  // Technical millimeter graduation lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  for (let y = 30; y < 480; y += 12) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(y % 48 === 0 ? 50 : 35, y);
    ctx.stroke();
  }

  // Brand and ergonomic specification imprint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('CHAPÍN · ERGO-3D', 70, 240);
  ctx.font = '12px monospace';
  ctx.fillText('ARCH SUPPORT: 18.4mm | BIO-POLYMER', 70, 265);
  ctx.fillText('TALLA 41 | PLANTAR ZONE A+', 70, 285);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
