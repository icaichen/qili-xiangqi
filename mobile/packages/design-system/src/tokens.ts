export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  round: 999,
} as const;

export const type = {
  label: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 0.6 },
  body: { fontSize: 15, lineHeight: 22 },
  title: { fontSize: 28, fontWeight: '900' as const, lineHeight: 34 },
  display: { fontSize: 36, fontWeight: '900' as const, lineHeight: 42 },
} as const;

export type ProductTheme = {
  kind: 'adult' | 'kids';
  canvas: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  subtle: string;
  border: string;
  brand: string;
  brandStrong: string;
  accent: string;
  accentSoft: string;
  nav: string;
};

export const adultTheme: ProductTheme = {
  kind: 'adult',
  canvas: '#f4f0e8',
  surface: '#fbfaf7',
  surfaceRaised: '#ffffff',
  text: '#1c1c1a',
  muted: '#77736c',
  subtle: '#9a968e',
  border: '#d9d3c8',
  brand: '#ed482f',
  brandStrong: '#d63824',
  accent: '#7357ff',
  accentSoft: '#efecff',
  nav: '#fbfaf7',
};

export const kidsTheme: ProductTheme = {
  kind: 'kids',
  canvas: '#f7f5ed',
  surface: '#fffdf8',
  surfaceRaised: '#ffffff',
  text: '#183047',
  muted: '#667789',
  subtle: '#8c98a4',
  border: '#dce2e3',
  brand: '#e95249',
  brandStrong: '#bc3934',
  accent: '#f4c84f',
  accentSoft: '#fff3c4',
  nav: '#173149',
};
