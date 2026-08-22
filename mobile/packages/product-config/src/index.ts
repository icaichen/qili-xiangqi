/** Shared, platform-neutral product contracts for the two QiliChess apps. */

export type ProductId = "qilichess" | "qilichesskids";

export type FeatureFlags = {
  readonly kidsTheme: boolean;
  readonly learningPath: boolean;
  readonly livePlay: boolean;
  readonly puzzles: boolean;
  readonly analysis: boolean;
};

export type ProductManifest = {
  readonly id: ProductId;
  readonly displayName: string;
  readonly subtitle: string;
  readonly scheme: string;
  readonly bundleId: string;
  readonly packageName: string;
  readonly features: FeatureFlags;
};

export const products = {
  qilichess: {
    id: "qilichess",
    displayName: "QiliChess",
    subtitle: "Play Chinese chess your way",
    scheme: "qilichess",
    bundleId: "com.qilichess.app",
    packageName: "com.qilichess.app",
    features: {
      kidsTheme: false,
      learningPath: true,
      livePlay: true,
      puzzles: false,
      analysis: true,
    },
  },
  qilichesskids: {
    id: "qilichesskids",
    displayName: "QiliChess Kids",
    subtitle: "Learn Chinese chess through play",
    scheme: "qilichesskids",
    bundleId: "com.qilichess.kids",
    packageName: "com.qilichess.kids",
    features: {
      kidsTheme: true,
      learningPath: true,
      livePlay: true,
      puzzles: true,
      analysis: true,
    },
  },
} as const satisfies Record<ProductId, ProductManifest>;

export type TimeControl = {
  readonly id: "bullet-1" | "blitz-3-2" | "blitz-5" | "rapid-10" | "rapid-15-10";
  readonly label: string;
  readonly initialSeconds: number;
  readonly incrementSeconds: number;
};

/** The shared clock catalog; the mobile clients only provide the presentation. */
export const timeControls = [
  { id: "bullet-1", label: "1 min", initialSeconds: 60, incrementSeconds: 0 },
  { id: "blitz-3-2", label: "3 + 2", initialSeconds: 180, incrementSeconds: 2 },
  { id: "blitz-5", label: "5 min", initialSeconds: 300, incrementSeconds: 0 },
  { id: "rapid-10", label: "10 min", initialSeconds: 600, incrementSeconds: 0 },
  { id: "rapid-15-10", label: "15 + 10", initialSeconds: 900, incrementSeconds: 10 },
] as const satisfies readonly TimeControl[];

export type NavigationItem = {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
};

export const navigation = {
  adult: [
    { id: "home", label: "主页", icon: "home" },
    { id: "play", label: "对弈", icon: "swords" },
    { id: "learn", label: "学习", icon: "book-open" },
    { id: "review", label: "复盘", icon: "review" },
    { id: "profile", label: "我的", icon: "user" },
  ],
  kids: [
    { id: "home", label: "首页", icon: "home" },
    { id: "play", label: "对弈", icon: "swords" },
    { id: "learn", label: "学习", icon: "book-open" },
    { id: "review", label: "复盘", icon: "review" },
    { id: "profile", label: "我的", icon: "user" },
  ],
} as const satisfies {
  readonly adult: readonly NavigationItem[];
  readonly kids: readonly NavigationItem[];
};

export const productConfig = { products, timeControls, navigation } as const;
