const ASSETS_UPDATE_KEY = 'epic7.damageDesk.assetsUpdate.v1';
const ASSETS_COMMITS_URL = 'https://api.github.com/repos/tyopoyt/epic7-damage-calc/commits?path=damage-calc/src/assets&per_page=1';

export type AssetsUpdateState = {
  status: 'idle' | 'checking' | 'current' | 'available' | 'importing' | 'imported' | 'browserOnly' | 'error';
  localDate?: string;
  remoteDate?: string;
  message?: string;
};

type AssetsMarker = {
  sha?: string;
  date?: string;
};

export function loadAssetsMarker(): AssetsMarker {
  try {
    return JSON.parse(localStorage.getItem(ASSETS_UPDATE_KEY) || '{}');
  } catch {
    return {};
  }
}

export async function checkAssetsUpdate(): Promise<AssetsUpdateState> {
  const local = loadAssetsMarker();
  if (!isTauriRuntime()) {
    return {
      status: 'browserOnly',
      localDate: formatDate(local.date),
      message: '网页预览不能直接导入，Win 程序可用',
    };
  }
  const remote = await fetchLatestAssetsCommit();
  if (!remote) {
    return {
      status: 'error',
      localDate: formatDate(local.date),
      message: '检查失败',
    };
  }

  const isNewer = !local.sha || local.sha !== remote.sha;
  return {
    status: isNewer ? 'available' : 'current',
    localDate: formatDate(local.date),
    remoteDate: formatDate(remote.date),
    message: isNewer ? '发现 assets 更新' : 'assets 已是最新',
  };
}

export async function importLatestAssets(): Promise<AssetsUpdateState> {
  const remote = await fetchLatestAssetsCommit();
  if (!remote) return { status: 'error', message: '检查失败' };

  if (!isTauriRuntime()) {
    return {
      status: 'browserOnly',
      remoteDate: formatDate(remote.date),
      message: '网页预览不能直接写入文件，打包成 Win 程序后可一键导入',
    };
  }

  return {
    status: 'error',
    remoteDate: formatDate(remote.date),
    message: '当前便携版需重新打包后更新 assets',
  };
}

async function fetchLatestAssetsCommit(): Promise<AssetsMarker | null> {
  try {
    const response = await fetch(ASSETS_COMMITS_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const first = Array.isArray(data) ? data[0] : null;
    return first?.sha && first?.commit?.committer?.date
      ? { sha: first.sha, date: first.commit.committer.date }
      : null;
  } catch {
    return null;
  }
}

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
