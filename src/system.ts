import fs from 'node:fs';
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import type { SystemInfo } from './types.ts';

const HOST_PROC = '/host/proc';
const HOST_ROOTFS = '/host/rootfs';

// Detect if host paths are mounted (i.e. running in a container)
const useHostProc = fs.existsSync(HOST_PROC);
const useHostRootfs = fs.existsSync(HOST_ROOTFS);

export async function getSystemInfo(): Promise<SystemInfo> {
  return {
    cpu: getCpuUsage(),
    ram: getRamUsage(),
    storage: await getDiskUsage(),
  };
}

function getCpuUsage() {
  const [oneMinute] = os.loadavg();
  const cores = useHostProc ? countCpuCores() : os.cpus().length || 1;
  const percentage = (oneMinute / cores) * 100;

  if (!Number.isFinite(percentage)) {
    return null;
  }

  return Math.max(0, Math.min(100, Number(percentage.toFixed(2))));
}

function countCpuCores() {
  try {
    const cpuinfo = fs.readFileSync(`${HOST_PROC}/cpuinfo`, 'utf-8');
    const cores = cpuinfo.match(/^processor\s*:/gm)?.length ?? 0;
    return cores || 1;
  } catch {
    return os.cpus().length || 1;
  }
}

function getRamUsage() {
  if (useHostProc) {
    return getHostRamUsage();
  }

  const total = os.totalmem();
  const free = os.freemem();

  if (!total) {
    return null;
  }

  return {
    used: bytesToGb(total - free),
    total: bytesToGb(total),
  };
}

function getHostRamUsage() {
  try {
    const meminfo = fs.readFileSync(`${HOST_PROC}/meminfo`, 'utf-8');
    const values = new Map<string, number>();

    for (const line of meminfo.split('\n')) {
      const match = line.match(/^(\w+):\s+(\d+)/);

      if (match) {
        values.set(match[1], Number(match[2]) * 1024); // kB → bytes
      }
    }

    const total = values.get('MemTotal') ?? 0;
    const available = values.get('MemAvailable') ?? values.get('MemFree') ?? 0;

    if (!total) {
      return null;
    }

    return {
      used: bytesToGb(total - available),
      total: bytesToGb(total),
    };
  } catch {
    return null;
  }
}

// Filesystem types that are virtual/pseudo and should not be reported as disks
const VIRTUAL_FS_TYPES = new Set([
  'autofs',
  'binfmt_misc',
  'cgroup',
  'cgroup2',
  'configfs',
  'debugfs',
  'devpts',
  'devtmpfs',
  'efivarfs',
  'fusectl',
  'hugetlbfs',
  'mqueue',
  'nsfs',
  'overlay',
  'proc',
  'pstore',
  'rpc_pipefs',
  'securityfs',
  'squashfs',
  'sysfs',
  'tmpfs',
  'tracefs',
]);

async function getDiskUsage() {
  const mounts = useHostRootfs
    ? getHostMountPoints()
    : getLocalMountPoints();

  if (!mounts.length) {
    return null;
  }

  const disks = await Promise.all(
    mounts.map(async (mount) => {
      try {
        const stats = await statfs(mount);
        const total = stats.blocks * stats.bsize;
        const free = stats.bavail * stats.bsize;

        if (!total) {
          return null;
        }

        return {
          mount: useHostRootfs ? mount.slice(HOST_ROOTFS.length) || '/' : mount,
          used: bytesToGb(total - free),
          total: bytesToGb(total),
        };
      } catch {
        return null;
      }
    })
  );

  const result = disks.filter(
    (d): d is NonNullable<typeof d> => Boolean(d)
  );

  return result.length ? result : null;
}

function parseMountPoints(content: string) {
  const byDevice = new Map<string, string>();

  for (const line of content.split('\n')) {
    const [device, mount, fstype] = line.split(' ');

    if (!device || !mount || !fstype) {
      continue;
    }

    if (VIRTUAL_FS_TYPES.has(fstype)) {
      continue;
    }

    if (
      mount.startsWith('/boot') ||
      mount.startsWith('/snap')
    ) {
      continue;
    }

    // Keep the shortest mount path per device to dedup bind mounts
    const existing = byDevice.get(device);

    if (!existing || mount.length < existing.length) {
      byDevice.set(device, mount);
    }
  }

  return [...byDevice.values()];
}

function getHostMountPoints() {
  try {
    const content = fs.readFileSync(`${HOST_PROC}/mounts`, 'utf-8');

    return parseMountPoints(content).map((m) => `${HOST_ROOTFS}${m}`);
  } catch {
    return [];
  }
}

function getLocalMountPoints() {
  try {
    const content = fs.readFileSync('/proc/mounts', 'utf-8');

    return parseMountPoints(content);
  } catch {
    // No /proc/mounts (e.g. macOS) — fall back to root
    return ['/'];
  }
}

function bytesToGb(value: number) {
  return Number((value / 1024 ** 3).toFixed(2));
}
