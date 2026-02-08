export type App = {
  id: string;
  container?: string;
  name: string;
  icon: string;
  url: string;
};

export type AppStatus = {
  id: string;
  state: string;
};

export type SystemInfo = {
  cpu: number | null;
  ram: {
    used: number;
    total: number;
  } | null;
  storage: Array<{
    mount: string;
    used: number;
    total: number;
  }> | null;
};
