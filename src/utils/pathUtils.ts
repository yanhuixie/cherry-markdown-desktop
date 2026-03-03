/**
 * 路径类型枚举
 */
export enum PathType {
  LOCAL,           // 本地文件路径（绝对路径）
  RELATIVE,        // 相对路径
  ASSET_URL,       // asset.localhost URL
  REMOTE_URL,      // 远程 HTTP URL（非 asset.localhost）
  DATA_URL,        // data: URL
}

/**
 * 识别路径类型
 * @param path 文件路径或 URL
 * @returns 路径类型
 */
export function identifyPath(path: string): PathType {
  // data: URL
  if (/^data:/.test(path)) {
    return PathType.DATA_URL;
  }

  // HTTP/HTTPS URL
  if (/^https?:\/\//.test(path)) {
    if (isAssetLocalhostUrl(path)) {
      return PathType.ASSET_URL;
    }
    return PathType.REMOTE_URL;
  }

  // Windows 绝对路径（如 D:\path）
  if (/^[A-Za-z]:/.test(path)) {
    return PathType.LOCAL;
  }

  // Unix 绝对路径（如 /path）
  if (/^\//.test(path)) {
    return PathType.LOCAL;
  }

  // 相对路径（默认）
  return PathType.RELATIVE;
}

/**
 * 解析相对路径，正确处理 . 和 ..
 * @param fromPath 基准路径（绝对路径）
 * @returns 解析后的绝对路径（保持原始路径分隔符格式）
 */
export function resolvePath(fromPath: string, relativePath: string): string {
  // 检查是否为 URL（http://、https://、file:// 等），如果是则直接返回
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relativePath)) {
    return relativePath;
  }

  // 检测是否为 Windows 路径
  const isWindowsPath = /^[A-Za-z]:/.test(fromPath);

  // 将路径统一转换为 / 格式进行解析（便于处理）
  const normalizedFrom = fromPath.replace(/\\/g, '/');
  const normalizedRelative = relativePath.replace(/\\/g, '/');

  // 提取基准目录
  const baseDir = normalizedFrom.substring(0, normalizedFrom.lastIndexOf('/'));

  // 手动解析相对路径，避免 new URL() 导致的双重编码问题
  const parts = baseDir.split('/');
  const relativeParts = normalizedRelative.split('/');

  for (const part of relativeParts) {
    if (part === '' || part === '.') {
      // 跳过空路径和当前目录
      continue;
    } else if (part === '..') {
      // 返回上级目录
      parts.pop();
    } else {
      // 添加路径部分
      parts.push(part);
    }
  }

  // 使用正斜杠连接
  let resolvedPath = parts.join('/');

  // Windows 路径处理：移除开头的 /，并恢复反斜杠
  if (isWindowsPath) {
    if (resolvedPath.startsWith('/')) {
      resolvedPath = resolvedPath.substring(1);
    }
    // 恢复 Windows 反斜杠格式
    resolvedPath = resolvedPath.replace(/\//g, '\\');
  }

  return resolvedPath;
}

/**
 * 判断路径是否为 asset.localhost 的 URL（本地文件的 HTTP 代理）
 * @param path 文件路径或 URL
 * @returns 如果是 asset.localhost URL 则返回 true
 */
export function isAssetLocalhostUrl(path: string): boolean {
  return /^http:\/\/asset\.localhost\//.test(path);
}

/**
 * 从 asset.localhost URL 提取本地文件路径
 * @param url asset.localhost 的 URL（如 http://asset.localhost/D%3A\path\to\file.md）
 * @returns 本地文件路径（如 D:\path\to\file.md），如果不是 asset.localhost URL 则返回原路径
 */
export function extractLocalPathFromAssetUrl(url: string): string {
  if (!isAssetLocalhostUrl(url)) {
    return url;
  }

  try {
    // 提取路径部分（去掉 http://asset.localhost/）
    let urlPath = url.substring('http://asset.localhost/'.length);

    console.log('[extractLocalPathFromAssetUrl] Step 1 - Extracted path:', urlPath);

    // 先将反斜杠替换为正斜杠（统一格式）
    urlPath = urlPath.replace(/\\/g, '/');

    console.log('[extractLocalPathFromAssetUrl] Step 2 - After replacing backslashes:', urlPath);

    // 使用 decodeURIComponent 而不是 decodeURI（更激进的解码）
    const decodedPath = decodeURIComponent(urlPath);

    console.log('[extractLocalPathFromAssetUrl] Step 3 - After decode:', decodedPath);

    // 将正斜杠转换为反斜杠（Windows 格式）
    const windowsPath = decodedPath.replace(/\//g, '\\');

    console.log('[extractLocalPathFromAssetUrl] Step 4 - Final Windows path:', windowsPath);

    return windowsPath;
  } catch (error) {
    console.error('[pathUtils] Failed to extract local path from asset URL:', error, 'URL:', url);
    return url;
  }
}

/**
 * 将本地文件路径转换为 asset.localhost URL
 * @param localPath 本地文件路径（如 D:\path\to\file.png）
 * @returns asset.localhost URL（如 http://asset.localhost/D%3A\path\to\file.png）
 */
export function convertLocalPathToAssetUrl(localPath: string): string {
  // 转换为正斜杠
  const normalizedPath = localPath.replace(/\\/g, '/');
  // URL 编码冒号（其他字符通常不需要编码）
  const encodedPath = normalizedPath.replace(/:/g, '%3A');
  return `http://asset.localhost/${encodedPath}`;
}

/**
 * 判断环境是否支持 asset.localhost
 * 通过检查当前文件路径是否为 asset.localhost URL
 * @param currentFilePath 当前文件的路径
 * @returns 如果环境支持 asset.localhost 则返回 true
 */
export function isAssetLocalhostAvailable(currentFilePath: string): boolean {
  return isAssetLocalhostUrl(currentFilePath);
}

/**
 * 统一路径分隔符为正斜杠
 * @param path 原始路径（可能包含 / 或 \）
 * @returns 使用正斜杠的路径
 */
export function normalizePathSeparator(path: string): string {
  return path.replace(/[/\\]/g, '/');
}

/**
 * 使用统一正则分割路径
 * @param path 原始路径（可能包含 / 或 \）
 * @returns 路径部分数组
 */
export function splitPath(path: string): string[] {
  return path.split(/[/\\]/);
}

/**
 * 从路径中提取文件名
 * @param path 文件路径
 * @returns 文件名（路径最后一部分）
 */
export function getFileName(path: string): string {
  return splitPath(path).pop() || path;
}
