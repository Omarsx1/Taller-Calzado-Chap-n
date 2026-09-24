/**
 * Tour data: hotspot definitions and per-zone camera views.
 *
 * Anchors are world-space points the HTML hotspot markers track. All
 * user-facing copy is Spanish; identifiers and comments stay English.
 */

export type ZoneId = 'textiles' | 'aparado' | 'moldeado';

/** Camera framing used by `flyTo`. */
export interface CameraView {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

export interface HotspotDef {
  id: string;
  zone: ZoneId;
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  anchor: readonly [number, number, number];
  view: CameraView;
}

export const HOTSPOTS = [
  {
    id: 'telar',
    zone: 'textiles',
    eyebrow: 'Zona A · Textiles y Corte',
    title: 'Telar artesanal, volumen industrial',
    body: 'Los telares de pedal siguen operando dentro de la línea. Los tejidos típicos se producen aquí y se pagan por metro tejido, no por hora, para que el artesano pueda aumentar su ingreso sin aumentar su jornada.',
    meta: 'Comercio justo: pago por pieza, no por hora',
    anchor: [-9.2, 2.1, -3.2],
    view: { position: [-8.0, 2.6, 2.2], target: [-9.2, 1.2, -3.2] },
  },
  {
    id: 'troquel',
    zone: 'textiles',
    eyebrow: 'Zona A · Textiles y Corte',
    title: 'Troquelado sin desperdicio',
    body: 'La troqueladora lineal (Clicker) corta la lona de algodón con troqueles anidados por software. Cada centímetro del rollo se aprovecha antes de pasar a la siguiente pieza, así el recorte se reduce al mínimo y los sobrantes vuelven a la cadena como relleno de empaque.',
    meta: '0 % de plástico virgen · 100 % lona de algodón reciclable',
    anchor: [-5.6, 2.3, -3.4],
    view: { position: [-3.6, 2.4, -0.6], target: [-5.6, 1.0, -3.4] },
  },
  {
    id: 'aparado',
    zone: 'aparado',
    eyebrow: 'Zona B · Aparado',
    title: 'Aparado de precisión',
    body: 'Máquinas de poste y brazo libre cosen la capellada en curvas cerradas que una máquina plana no alcanza. Trabajar con máquinas ergonómicas y asientos regulables reduce la fatiga y el riesgo de lesión del operario.',
    meta: 'Puestos con altura y respaldo regulables',
    anchor: [-0.4, 1.9, -4.2],
    view: { position: [-0.4, 2.5, -0.4], target: [-0.4, 1.1, -4.2] },
  },
  {
    id: 'prensa',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Cementado sin solventes',
    body: 'Las prensas neumáticas aplican presión uniforme para fijar la planta a la suela con adhesivo base agua. Al eliminar los solventes orgánicos, la emisión de compuestos volátiles dentro de la planta baja a prácticamente cero.',
    meta: 'Huella de carbono: −62 % frente al cementado tradicional',
    anchor: [1.6, 2.6, 4.2],
    view: { position: [1.6, 2.6, 0.8], target: [1.6, 1.0, 4.2] },
  },
  {
    id: 'hormas',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Hormas ergonómicas 3D',
    body: 'Cada horma se modela a partir del arco plantar real del usuario. La adaptabilidad a la salud plantar significa menos presión en el talón y el metatarso, y menos descarte por devoluciones.',
    meta: 'Diseño validado sobre análisis de pisada',
    anchor: [6.4, 3.1, 2.8],
    view: { position: [3.4, 3.0, 0.2], target: [6.4, 1.3, 2.8] },
  },
  {
    id: 'suelas',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Caucho natural, no plástico',
    body: 'La suela se vulcaniza con caucho natural de plantación certificada. Se degrada sin liberar microplásticos, a diferencia del EVA y el PVC que dominan el mercado de la chancla desechable.',
    meta: 'Sin microplásticos · vulcanizado de baja energía',
    anchor: [-3.0, 1.5, 3.8],
    view: { position: [-3.0, 2.4, 0.6], target: [-3.0, 0.8, 3.8] },
  },
  {
    id: 'chanclas',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Chanclas Chapín · Producto Terminado',
    body: 'El modelo final en 3D: chancla ergonómica elaborada con caucho natural vulcanizado, arco biomecánico y capellada textil tradicional. Cada par fusiona tecnología limpia con la herencia textil guatemalteca.',
    meta: 'Modelo 3D real exportado en .glb · 100% biodegradable',
    anchor: [0.0, 1.4, 5.2],
    view: { position: [0.0, 1.6, 6.4], target: [0.0, 0.95, 5.2] },
  },
] as const satisfies readonly HotspotDef[];

export const ZONE_VIEWS = {
  textiles: { position: [-3.0, 5.4, 3.6], target: [-8.0, 1.2, -3.0] },
  aparado: { position: [-0.4, 5.0, 2.2], target: [-0.4, 1.0, -4.0] },
  moldeado: { position: [0.0, 5.6, 9.6], target: [2.0, 1.0, 3.6] },
} as const satisfies Record<ZoneId, CameraView>;
