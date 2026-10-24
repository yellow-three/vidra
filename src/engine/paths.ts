// Masaustu (/ veya \) ve Android yollarini Node `path` modulu olmadan ayristirir.

export function splitPath(path: string): { dir: string; name: string; sep: string } {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const sep = idx >= 0 ? path[idx] : '/';
  return { dir: idx >= 0 ? path.slice(0, idx) : '', name: path.slice(idx + 1), sep };
}

export function stem(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? dir + name : dir + sep + name;
}
