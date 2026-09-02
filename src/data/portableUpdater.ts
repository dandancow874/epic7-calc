import { invoke } from '@tauri-apps/api/core';

const RELEASES_URL = 'https://api.github.com/repos/dandancow874/epic7-calc/releases/latest';
const PORTABLE_ZIP_PATTERN = /^Epic7\.Damage\.Calc\.Portable_v\d+\.\d+\.\d+\.zip$/;

export type PortableUpdateState = {
  status: 'idle' | 'checking' | 'current' | 'available' | 'updating' | 'browserOnly' | 'error';
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  downloadSize?: number;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  message?: string;
};

type GitHubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
    size?: number;
  }>;
};

export const CURRENT_APP_VERSION = normalizeVersion(__APP_VERSION__);

export function initialPortableUpdateState(): PortableUpdateState {
  return {
    status: 'idle',
    currentVersion: CURRENT_APP_VERSION,
  };
}

export async function checkPortableUpdate(): Promise<PortableUpdateState> {
  if (!isTauriRuntime()) {
    return {
      status: 'browserOnly',
      currentVersion: CURRENT_APP_VERSION,
      message: '网页预览不能一键更新',
    };
  }

  const release = await fetchLatestRelease();
  if (!release?.tag_name) {
    return {
      status: 'error',
      currentVersion: CURRENT_APP_VERSION,
      message: '检查更新失败',
    };
  }

  const latestVersion = normalizeVersion(release.tag_name);
  const releaseDetails = {
    releaseName: release.name?.trim() || `v${latestVersion}`,
    releaseNotes: release.body?.trim() || '该版本未填写更新说明。',
    releaseUrl: release.html_url,
  };
  const asset = release.assets?.find((item) => item.name && PORTABLE_ZIP_PATTERN.test(item.name));
  if (!asset?.browser_download_url) {
    return {
      status: 'error',
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      ...releaseDetails,
      message: '最新 Release 没有便携版 zip',
    };
  }

  if (compareVersions(latestVersion, CURRENT_APP_VERSION) <= 0) {
    return {
      status: 'current',
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      downloadUrl: asset.browser_download_url,
      downloadSize: asset.size,
      ...releaseDetails,
      message: '已是最新版本',
    };
  }

  return {
    status: 'available',
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    downloadUrl: asset.browser_download_url,
    downloadSize: asset.size,
    ...releaseDetails,
    message: `发现 ${latestVersion}`,
  };
}

export async function startPortableUpdate(state: PortableUpdateState): Promise<PortableUpdateState> {
  if (!state.downloadUrl || !state.latestVersion) {
    return { ...state, status: 'error', message: '没有可用更新包' };
  }
  await invoke('start_portable_update', {
    downloadUrl: state.downloadUrl,
    version: state.latestVersion,
  });
  return {
    ...state,
    status: 'updating',
    message: '正在更新，程序将自动重启',
  };
}

function normalizeVersion(value: string) {
  const normalized = value.trim().replace(/^v/i, '');
  return normalized || '0.0.0';
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map((item) => Number(item) || 0);
  const rightParts = right.split('.').map((item) => Number(item) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window;
}
