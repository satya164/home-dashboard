export type Config = {
  apps: Array<{
    name: string;
    icon: string;
    url: {
      internal: string;
      external: string;
    };
  }>;
  dashdot: {
    url: string;
  };
};
