/**
 * Tour data: hotspot definitions and per-zone camera views.
 *
 * Anchors are world-space points the HTML hotspot markers track. All
 * user-facing copy is Spanish; identifiers and comments stay English.
 */

export type ZoneId =
  | 'panoramica'
  | 'almacen'
  | 'textiles'
  | 'aparado'
  | 'moldeado'
  | 'empaque'
  | 'expansion';

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
    id: 'almacen',
    zone: 'almacen',
    eyebrow: 'Zona Oeste · Materias Primas',
    title: 'Almacén de Lonas y Caucho Certificado',
    body: 'Recepción y acopio de bobinas de lona de algodón orgánico teñido artesanalmente y fardos de caucho natural de plantación guatemalteca. El inventario se gestiona por lote para asegurar trazabilidad limpia de cada par.',
    meta: '100% materias primas biodegradables',
    anchor: [-26.0, 2.2, -6.5],
    view: { position: [-22.0, 3.4, 4.5], target: [-26.0, 1.4, -4.5] },
  },
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
    anchor: [1.2, 2.6, 3.8],
    view: { position: [1.2, 2.6, 0.8], target: [1.2, 1.0, 3.8] },
  },
  {
    id: 'hormas',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Hormas ergonómicas 3D',
    body: 'Cada horma se modela a partir del arco plantar real del usuario. La adaptabilidad a la salud plantar significa menos presión en el talón y el metatarso, y menos descarte por devoluciones.',
    meta: 'Diseño validado sobre análisis de pisada',
    anchor: [6.2, 3.1, 2.8],
    view: { position: [3.4, 3.0, 0.2], target: [6.2, 1.3, 2.8] },
  },
  {
    id: 'suelas',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Caucho natural, no plástico',
    body: 'La suela se vulcaniza con caucho natural de plantación certificada. Se degrada sin liberar microplásticos, a diferencia del EVA y el PVC que dominan el mercado de la chancla desechable.',
    meta: 'Sin microplásticos · vulcanizado de baja energía',
    anchor: [-3.2, 1.5, 4.0],
    view: { position: [-3.2, 2.4, 1.0], target: [-3.2, 0.8, 4.0] },
  },
  {
    id: 'chanclas',
    zone: 'moldeado',
    eyebrow: 'Zona C · Moldeado 3D',
    title: 'Chanclas Chapín · Producto Terminado',
    body: 'El modelo final en 3D: chancla ergonómica elaborada con caucho natural vulcanizado, arco biomecánico y capellada textil tradicional. Cada par fusiona tecnología limpia con la herencia textil guatemalteca.',
    meta: 'Modelo 3D real exportado en .glb · 100% biodegradable',
    anchor: [0.0, 1.4, 5.8],
    view: { position: [0.0, 1.35, 6.9], target: [0.0, 0.98, 5.8] },
  },
  {
    id: 'empaque',
    zone: 'empaque',
    eyebrow: 'Zona Este · Control y Empaque',
    title: 'Control de Calidad y Embalaje Circular',
    body: 'Cada par terminado pasa por inspección de costuras, flexibilidad del arco y acabado superficial antes de ser embalado en cajas de cartón kraft 100% reciclado sin tintas plásticas ni grapas metálicas.',
    meta: 'Empaque biodegradable con cero plástico',
    anchor: [18.0, 2.0, -3.5],
    view: { position: [14.0, 3.2, 3.5], target: [18.0, 1.3, -3.5] },
  },
  {
    id: 'expansion',
    zone: 'expansion',
    eyebrow: 'Fase 2 · Área de Futura Expansión',
    title: 'Crecimiento Sostenible del Taller',
    body: 'Área reservada para la ampliación de la planta: próxima línea automatizada de prensado solar y laboratorio de reciclaje circular de calzado. El taller está diseñado para triplicar su capacidad manteniendo su compromiso artesanal y ambiental.',
    meta: 'Infraestructura modular preparada para expansión limpia',
    anchor: [36.0, 2.4, 0.0],
    view: { position: [30.0, 4.2, 8.5], target: [38.0, 1.5, 0.0] },
  },
] as const satisfies readonly HotspotDef[];

export const ZONE_VIEWS = {
  panoramica: { position: [3.8, 17.5, 58.0], target: [3.8, 3.5, 0.0] },
  almacen: { position: [-22.0, 3.8, 7.5], target: [-26.0, 1.4, -3.5] },
  textiles: { position: [-6.8, 3.2, 1.2], target: [-8.2, 1.2, -3.2] },
  aparado: { position: [-0.4, 3.2, 0.4], target: [-0.4, 1.1, -4.2] },
  moldeado: { position: [0.0, 4.0, 10.2], target: [0.0, 1.1, 4.0] },
  empaque: { position: [14.0, 3.8, 7.5], target: [18.0, 1.4, -3.5] },
  expansion: { position: [30.0, 4.8, 12.0], target: [38.0, 1.6, 0.0] },
} as const satisfies Record<ZoneId, CameraView>;
