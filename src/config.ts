import fs from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

const CONFIG_PATH = 'config/config.yml';

export const schema = z.object({
  apps: z
    .array(
      z.object({
        container: z.string().min(1).optional(),
        name: z.string().optional(),
        icon: z.string().optional(),
        url: z.string().optional(),
        request: z
          .object({
            method: z.string().optional(),
            status_codes: z.array(z.number()).optional(),
          })
          .optional(),
      })
    )
    .optional(),
  ignore: z.array(z.string()).optional(),
  traefik: z
    .object({
      url: z.string().optional(),
    })
    .optional(),
  wallpaper: z
    .union([z.object({ url: z.string() }), z.object({ file: z.string() })])
    .optional(),
});

export async function loadConfig(): Promise<z.infer<typeof schema>> {
  try {
    await fs.promises.access(CONFIG_PATH, fs.constants.F_OK);
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      return {
        apps: [],
      };
    }
  }

  const raw = await fs.promises.readFile(CONFIG_PATH, 'utf-8');

  return schema.parse(parse(raw)) as z.infer<typeof schema>;
}
