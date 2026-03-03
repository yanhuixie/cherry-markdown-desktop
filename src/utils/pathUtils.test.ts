import { describe, it, expect } from 'vitest';
import {
  PathType,
  identifyPath,
  resolvePath,
  isAssetLocalhostUrl,
  extractLocalPathFromAssetUrl,
  convertLocalPathToAssetUrl,
  normalizePathSeparator,
  splitPath,
  getFileName,
} from './pathUtils';

describe('pathUtils', () => {
  describe('identifyPath', () => {
    it('应识别 data URL', () => {
      expect(identifyPath('data:text/plain;base64,SGVsbG8=')).toBe(PathType.DATA_URL);
      expect(identifyPath('data:image/png;base64,iVBORw0KGgo=')).toBe(PathType.DATA_URL);
    });

    it('应识别 asset.localhost URL', () => {
      expect(identifyPath('http://asset.localhost/D%3A/path/to/file.md')).toBe(PathType.ASSET_URL);
    });

    it('应识别远程 HTTP/HTTPS URL', () => {
      expect(identifyPath('http://example.com/file.md')).toBe(PathType.REMOTE_URL);
      expect(identifyPath('https://example.com/file.md')).toBe(PathType.REMOTE_URL);
    });

    it('应识别 Windows 本地路径', () => {
      expect(identifyPath('D:\\path\\to\\file.md')).toBe(PathType.LOCAL);
      expect(identifyPath('C:\\Users\\test\\file.md')).toBe(PathType.LOCAL);
      expect(identifyPath('d:\\path\\to\\file.md')).toBe(PathType.LOCAL); // 小写盘符
    });

    it('应识别 Unix 本地路径', () => {
      expect(identifyPath('/path/to/file.md')).toBe(PathType.LOCAL);
      expect(identifyPath('/home/user/file.md')).toBe(PathType.LOCAL);
    });

    it('应识别相对路径', () => {
      expect(identifyPath('./file.md')).toBe(PathType.RELATIVE);
      expect(identifyPath('../parent/file.md')).toBe(PathType.RELATIVE);
      expect(identifyPath('folder/file.md')).toBe(PathType.RELATIVE);
    });
  });

  describe('resolvePath', () => {
    it('应直接返回 URL 类型路径', () => {
      expect(resolvePath('D:\\base\\file.md', 'http://example.com/other.md'))
        .toBe('http://example.com/other.md');
      expect(resolvePath('D:\\base\\file.md', 'https://example.com/other.md'))
        .toBe('https://example.com/other.md');
      expect(resolvePath('D:\\base\\file.md', 'file:///path/to/file.md'))
        .toBe('file:///path/to/file.md');
    });

    it('应解析 Windows 相对路径', () => {
      expect(resolvePath('D:\\base\\file.md', './other.md'))
        .toBe('D:\\base\\other.md');
      expect(resolvePath('D:\\base\\file.md', '../other.md'))
        .toBe('D:\\other.md');
      expect(resolvePath('D:\\base\\folder\\file.md', '../other.md'))
        .toBe('D:\\base\\other.md');
    });

    it('应解析 Unix 相对路径', () => {
      expect(resolvePath('/base/file.md', './other.md'))
        .toBe('/base/other.md');
      expect(resolvePath('/base/file.md', '../other.md'))
        .toBe('/other.md');
      expect(resolvePath('/base/folder/file.md', '../other.md'))
        .toBe('/base/other.md');
    });

    it('应处理多个连续的 ..', () => {
      expect(resolvePath('D:\\a\\b\\c\\file.md', '../../other.md'))
        .toBe('D:\\a\\other.md');
      expect(resolvePath('/a/b/c/file.md', '../../other.md'))
        .toBe('/a/other.md');
    });

    it('应忽略 ./ 和空路径部分', () => {
      expect(resolvePath('D:\\base\\file.md', '././other.md'))
        .toBe('D:\\base\\other.md');
    });
  });

  describe('isAssetLocalhostUrl', () => {
    it('应识别 asset.localhost URL', () => {
      expect(isAssetLocalhostUrl('http://asset.localhost/D%3A/path/file.md')).toBe(true);
      expect(isAssetLocalhostUrl('http://asset.localhost/C%3A/test.png')).toBe(true);
    });

    it('应拒绝非 asset.localhost URL', () => {
      expect(isAssetLocalhostUrl('http://example.com/file.md')).toBe(false);
      expect(isAssetLocalhostUrl('https://asset.localhost/file.md')).toBe(false); // https
      expect(isAssetLocalhostUrl('D:\\path\\file.md')).toBe(false);
    });
  });

  describe('extractLocalPathFromAssetUrl', () => {
    it('应从 asset.localhost URL 提取本地路径', () => {
      // URL 编码的 Windows 路径
      expect(extractLocalPathFromAssetUrl('http://asset.localhost/D%3A/path/to/file.md'))
        .toBe('D:\\path\\to\\file.md');
    });

    it('应原样返回非 asset.localhost URL', () => {
      expect(extractLocalPathFromAssetUrl('http://example.com/file.md'))
        .toBe('http://example.com/file.md');
      expect(extractLocalPathFromAssetUrl('D:\\path\\file.md'))
        .toBe('D:\\path\\file.md');
    });
  });

  describe('convertLocalPathToAssetUrl', () => {
    it('应将 Windows 路径转换为 asset.localhost URL', () => {
      expect(convertLocalPathToAssetUrl('D:\\path\\to\\file.md'))
        .toBe('http://asset.localhost/D%3A/path/to/file.md');
      expect(convertLocalPathToAssetUrl('C:\\Users\\test\\file.md'))
        .toBe('http://asset.localhost/C%3A/Users/test/file.md');
    });
  });

  describe('normalizePathSeparator', () => {
    it('应将所有分隔符统一为正斜杠', () => {
      expect(normalizePathSeparator('D:\\path\\to\\file.md')).toBe('D:/path/to/file.md');
      expect(normalizePathSeparator('/path/to/file.md')).toBe('/path/to/file.md');
      expect(normalizePathSeparator('mixed/path\\to/file.md')).toBe('mixed/path/to/file.md');
    });
  });

  describe('splitPath', () => {
    it('应按任意分隔符分割路径', () => {
      expect(splitPath('D:\\path\\to\\file.md')).toEqual(['D:', 'path', 'to', 'file.md']);
      expect(splitPath('/path/to/file.md')).toEqual(['', 'path', 'to', 'file.md']);
      expect(splitPath('mixed/path\\to/file.md')).toEqual(['mixed', 'path', 'to', 'file.md']);
    });
  });

  describe('getFileName', () => {
    it('应从 Windows 路径提取文件名', () => {
      expect(getFileName('D:\\path\\to\\file.md')).toBe('file.md');
    });

    it('应从 Unix 路径提取文件名', () => {
      expect(getFileName('/path/to/file.md')).toBe('file.md');
    });

    it('应从仅有文件名的路径返回文件名', () => {
      expect(getFileName('file.md')).toBe('file.md');
    });

    it('应处理混合分隔符', () => {
      expect(getFileName('path/to\\file.md')).toBe('file.md');
    });
  });
});
