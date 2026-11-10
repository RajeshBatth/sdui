export type Face = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

export interface TextToken {
  face: Face;
  family?: string;
  size: number;
  lineHeight: number;
  case?: 'upper' | 'lower' | 'title';
  role?: 'heading';
  letterSpacing?: number;
}
export interface GradientToken {
  angle: number;
  stops: [color: string, offset: number][];
}
export interface StrokeToken {
  width: number;
  color: string;
  dash?: [number, number];
}
export interface ShadowToken {
  x: number;
  y: number;
  blur: number;
  spread?: number;
  color: string;
  inset?: boolean;
}

export interface IconPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fillOpacity?: number;
}
export interface IconGradient {
  id: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  stops: [offset: number, color: string][];
}
export type IconDef =
  | { paths: IconPath[]; viewBox?: string; size?: number; gradients?: IconGradient[] }
  | { url: string; size?: number };

export type LookFields = Record<string, string | number>;

export type ShadowValue = ShadowToken | ShadowToken[];
export type FontTable = Record<string, Partial<Record<Face, string>>>;

export interface Manifest {
  font: FontTable;
  color: Record<string, string>;
  gradient: Record<string, GradientToken>;
  text: Record<string, TextToken>;
  size: Record<string, number>;
  stroke: Record<string, StrokeToken>;
  radius: Record<string, number>;
  space: Record<string, number>;
  shadow: Record<string, ShadowValue>;
  aspect: Record<string, number>;
  opacity: Record<string, number>;
  icon: Record<string, IconDef>;
  palette: Record<string, string[]>;
  look: Record<string, Record<string, LookFields>>;
}

export type TokenScale = 'color' | 'gradient' | 'text' | 'size' | 'stroke' | 'radius' | 'space' | 'shadow' | 'aspect' | 'opacity';

export type StyleScale = TokenScale | 'icon' | 'look' | { keyword: readonly string[] };
export type StyleSpec = Readonly<Record<string, StyleScale>>;
