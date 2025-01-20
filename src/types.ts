export type Config = {
  apps: Array<{
    name: string;
    icon: string;
    url: {
      internal: string;
      external: string;
    };
    request?: {
      path?: string;
      method?: string;
      status_codes?: number[];
    };
  }>;
  dashdot?: {
    url: string;
  };
  wallpaper?: { url: string } | { file: string };
};
