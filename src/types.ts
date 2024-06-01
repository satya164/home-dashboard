export type Config = {
  apps: Array<{
    name: string;
    icon: string;
    url: {
      internal: string;
      external: string;
    };
    request?: {
      method?: string;
      status_codes?: number[];
    };
  }>;
  dashdot?: {
    url: string;
  };
  wallpaper?: { url: string } | { file: string };
};
