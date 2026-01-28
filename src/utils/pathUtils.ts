/**
 * 解析相对路径，正确处理 . 和 ..
 * @param fromPath 基准路径（绝对路径）
 * @returns 解析后的绝对路径（保持原始路径分隔符格式）
 */
export function resolvePath(fromPath: string, relativePath: string): string {
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
