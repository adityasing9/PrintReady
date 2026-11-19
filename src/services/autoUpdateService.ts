export const CURRENT_APP_VERSION = '1.0.0';
export const CURRENT_VERSION_CODE = 1;
export const GITHUB_REPO = 'adityasing9/PrintReady';

export interface ReleaseInfo {
  version: string;
  name: string;
  notes: string;
  publishedAt: string;
  apkDownloadUrl?: string;
  htmlUrl: string;
  isNewer: boolean;
}

export function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform && cap?.getPlatform && cap.getPlatform() === 'android');
}

export function isVersionGreater(remote: string, current: string): boolean {
  const cleanRemote = remote.replace(/^v/i, '').trim();
  const cleanCurrent = current.replace(/^v/i, '').trim();

  const rParts = cleanRemote.split('.').map((n) => parseInt(n, 10) || 0);
  const cParts = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(rParts.length, cParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export async function checkForUpdate(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.status || res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.statusText}`);
    }

    const data = await res.json();
    const remoteVersion = data.tag_name || data.name || '';
    const isNewer = isVersionGreater(remoteVersion, CURRENT_APP_VERSION);

    let apkDownloadUrl: string | undefined = undefined;
    if (Array.isArray(data.assets)) {
      const apkAsset = data.assets.find(
        (a: { name?: string; browser_download_url?: string }) =>
          a.name?.endsWith('.apk')
      );
      if (apkAsset) {
        apkDownloadUrl = apkAsset.browser_download_url;
      }
    }

    return {
      version: remoteVersion,
      name: data.name || remoteVersion,
      notes: data.body || 'Performance improvements and bug fixes.',
      publishedAt: data.published_at || new Date().toISOString(),
      apkDownloadUrl,
      htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      isNewer,
    };
  } catch (err) {
    console.warn('Check for updates failed:', err);
    return null;
  }
}

export function installUpdate(downloadUrl: string): void {
  window.open(downloadUrl, '_system');
}
