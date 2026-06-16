export function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

export async function readPortableJson<T>(name: string): Promise<T | null> {
  if (!isTauriRuntime()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const text = await invoke<string | null>('read_data_file', { name });
    return text ? JSON.parse(text) as T : null;
  } catch (error) {
    console.warn(`read ${name} failed`, error);
    return null;
  }
}

export async function writePortableJson(name: string, value: unknown) {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_data_file', {
      name,
      contents: JSON.stringify(value, null, 2),
    });
  } catch (error) {
    console.warn(`write ${name} failed`, error);
  }
}

export async function getPortableDataDir() {
  if (!isTauriRuntime()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('data_dir');
  } catch (error) {
    console.warn('read data dir failed', error);
    return null;
  }
}
