import { reactive, ref } from 'vue';
import { normalizePathSeparator } from '../utils/pathUtils';

/** 文件树节点 */
export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
  /** 文件/目录最后修改时间（毫秒时间戳） */
  modifiedTime: number | null;
  /** 文件大小（字节），目录为 null */
  fileSize: number | null;
}

/** 侧边栏标签类型 */
export type SidebarTab = 'openFiles' | 'fileExplorer';

/** 侧边栏配置 */
export interface SidebarConfig {
  minWidth: number;
  maxWidth: number;
  collapsedWidth: number;
  defaultWidth: number;
}

/** 侧边栏状态 */
export interface SidebarState {
  isCollapsed: boolean;
  width: number;
  activeTab: SidebarTab;
  openedFolderPath: string | null;
  fileTree: FileTreeNode[];
  isLoadingTree: boolean;
  treeError: string | null;
}

// 配置常量
export const SIDEBAR_CONFIG: SidebarConfig = {
  minWidth: 180,
  maxWidth: 500,
  collapsedWidth: 48,
  defaultWidth: 250,
};

// 持久化存储键名
const STORAGE_KEY_WIDTH = 'cherry_markdown_sidebar_width';
const STORAGE_KEY_COLLAPSED = 'cherry_markdown_sidebar_collapsed';
const STORAGE_KEY_FOLDER = 'cherry_markdown_sidebar_folder';
const STORAGE_KEY_EXPANDED_NODES = 'cherry_markdown_sidebar_expanded_nodes';

// 从持久化存储加载宽度
const loadWidthFromStorage = (): number => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= SIDEBAR_CONFIG.minWidth && width <= SIDEBAR_CONFIG.maxWidth) {
        return width;
      }
    }
  } catch (error) {
    console.warn('[sidebarStore] 加载侧边栏宽度失败:', error);
  }
  return SIDEBAR_CONFIG.defaultWidth;
};

// 从持久化存储加载折叠状态
const loadCollapsedFromStorage = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch (error) {
    console.warn('[sidebarStore] 加载侧边栏折叠状态失败:', error);
  }
  return false;
};

// 从持久化存储加载打开的文件夹路径
const loadFolderFromStorage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_FOLDER);
  } catch (error) {
    console.warn('[sidebarStore] 加载侧边栏文件夹路径失败:', error);
  }
  return null;
};

// 从持久化存储加载展开的节点路径
const loadExpandedNodesFromStorage = (): Set<string> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_EXPANDED_NODES);
    if (saved) {
      const paths = JSON.parse(saved) as string[];
      return new Set(paths);
    }
  } catch (error) {
    console.warn('[sidebarStore] 加载展开节点失败:', error);
  }
  return new Set();
};

// 保存宽度到持久化存储
const saveWidthToStorage = (width: number) => {
  try {
    localStorage.setItem(STORAGE_KEY_WIDTH, width.toString());
  } catch (error) {
    console.warn('[sidebarStore] 保存侧边栏宽度失败:', error);
  }
};

// 保存折叠状态到持久化存储
const saveCollapsedToStorage = (collapsed: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, collapsed.toString());
  } catch (error) {
    console.warn('[sidebarStore] 保存侧边栏折叠状态失败:', error);
  }
};

// 保存文件夹路径到持久化存储
const saveFolderToStorage = (folderPath: string | null) => {
  try {
    if (folderPath) {
      localStorage.setItem(STORAGE_KEY_FOLDER, folderPath);
    } else {
      localStorage.removeItem(STORAGE_KEY_FOLDER);
    }
  } catch (error) {
    console.warn('[sidebarStore] 保存侧边栏文件夹路径失败:', error);
  }
};

// 保存展开的节点路径到持久化存储
const saveExpandedNodesToStorage = (paths: Set<string>) => {
  try {
    localStorage.setItem(STORAGE_KEY_EXPANDED_NODES, JSON.stringify([...paths]));
  } catch (error) {
    console.warn('[sidebarStore] 保存展开节点失败:', error);
  }
};

// 侧边栏状态
export const sidebarState = reactive<SidebarState>({
  isCollapsed: loadCollapsedFromStorage(),
  width: loadWidthFromStorage(),
  activeTab: 'openFiles',
  openedFolderPath: loadFolderFromStorage(),
  fileTree: [],
  isLoadingTree: false,
  treeError: null,
});

// 展开的节点路径集合
export const expandedNodePaths = ref<Set<string>>(loadExpandedNodesFromStorage());

/**
 * 切换侧边栏折叠状态
 */
export function toggleSidebar(): void {
  sidebarState.isCollapsed = !sidebarState.isCollapsed;
  saveCollapsedToStorage(sidebarState.isCollapsed);
}

/**
 * 设置侧边栏折叠状态
 */
export function setSidebarCollapsed(collapsed: boolean): void {
  sidebarState.isCollapsed = collapsed;
  saveCollapsedToStorage(collapsed);
}

/**
 * 设置侧边栏宽度
 */
export function setSidebarWidth(width: number): void {
  const clampedWidth = Math.max(SIDEBAR_CONFIG.minWidth, Math.min(SIDEBAR_CONFIG.maxWidth, width));
  sidebarState.width = clampedWidth;
  saveWidthToStorage(clampedWidth);
}

/**
 * 切换侧边栏标签
 */
export function setActiveSidebarTab(tab: SidebarTab): void {
  sidebarState.activeTab = tab;
}

/**
 * 检查文件是否为 Markdown 文件
 */
function isSupportedFile(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.endsWith('.md') || lowerName.endsWith('.markdown')
    || lowerName.endsWith('.html') || lowerName.endsWith('.htm');
}

/**
 * 检查是否为隐藏文件/文件夹（以 . 开头）
 */
function isHidden(name: string): boolean {
  return name.startsWith('.');
}

/**
 * 创建文件树节点
 */
function createTreeNode(
  name: string, path: string, isDirectory: boolean,
  mtime: number | null = null, size: number | null = null,
): FileTreeNode {
  return {
    name,
    path: normalizePathSeparator(path),
    isDirectory,
    children: [],
    isExpanded: expandedNodePaths.value.has(normalizePathSeparator(path)),
    isLoading: false,
    modifiedTime: mtime,
    fileSize: isDirectory ? null : size,
  };
}

/**
 * 排序文件树节点
 * 文件夹优先，然后按名称字母顺序（不区分大小写）
 */
function sortTreeNodes(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    // 文件夹优先
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    // 按名称排序（不区分大小写）
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * 动态导入 Tauri FS 模块
 */
async function importTauriFs() {
  try {
    const { readDir, stat } = await import('@tauri-apps/plugin-fs');
    return { readDir, stat };
  } catch (error) {
    console.error('[sidebarStore] 导入 Tauri FS 模块失败:', error);
    throw new Error('无法加载文件系统模块');
  }
}

/**
 * 加载目录内容
 * @param dirPath 目录路径
 * @param maxDepth 最大递归深度（默认 10）
 * @param currentDepth 当前递归深度
 * @returns 文件树节点数组
 */
export async function loadDirectoryContents(
  dirPath: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<FileTreeNode[]> {
  if (currentDepth >= maxDepth) {
    console.warn(`[sidebarStore] 达到最大递归深度 ${maxDepth}，停止加载: ${dirPath}`);
    return [];
  }

  try {
    const { readDir, stat } = await importTauriFs();
    const entries = await readDir(dirPath);
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      // 跳过隐藏文件
      if (isHidden(entry.name)) {
        continue;
      }

      // 构建完整路径（统一正斜杠）
      const normalizedDir = normalizePathSeparator(dirPath);
      const fullPath = `${normalizedDir}/${entry.name}`;

      if (entry.isDirectory) {
        // 目录：不获取元数据，直接创建节点
        const node = createTreeNode(entry.name, fullPath, true, null, null);
        if (node.isExpanded) {
          node.children = await loadDirectoryContents(fullPath, maxDepth, currentDepth + 1);
        }
        nodes.push(node);
      } else if (entry.isFile && isSupportedFile(entry.name)) {
        // 文件：获取元数据后创建节点
        let mtime: number | null = null;
        let size: number | null = null;
        try {
          const info = await stat(fullPath);
          mtime = info.mtime?.getTime() ?? null;
          size = info.size;
        } catch (e) {
          console.warn(`[sidebarStore] stat 失败: "${fullPath}"`, e);
        }
        nodes.push(createTreeNode(entry.name, fullPath, false, mtime, size));
      }
    }

    sortTreeNodes(nodes);
    return nodes;
  } catch (error) {
    console.error(`[sidebarStore] 加载目录失败: ${dirPath}`, error);
    throw error;
  }
}

/**
 * 打开文件夹
 */
export async function openFolder(folderPath: string): Promise<void> {
  sidebarState.isLoadingTree = true;
  sidebarState.treeError = null;
  sidebarState.openedFolderPath = folderPath;

  try {
    sidebarState.fileTree = await loadDirectoryContents(folderPath);
    saveFolderToStorage(folderPath);
    console.log('[sidebarStore] 文件夹已打开:', folderPath);
  } catch (error) {
    const errorMsg = error?.toString() || '未知错误';
    sidebarState.treeError = errorMsg;
    sidebarState.fileTree = [];
    console.error('[sidebarStore] 打开文件夹失败:', errorMsg);
  } finally {
    sidebarState.isLoadingTree = false;
  }
}

/**
 * 关闭文件夹
 */
export function closeFolder(): void {
  sidebarState.openedFolderPath = null;
  sidebarState.fileTree = [];
  sidebarState.treeError = null;
  saveFolderToStorage(null);
  // 清除展开节点记录
  expandedNodePaths.value.clear();
  saveExpandedNodesToStorage(expandedNodePaths.value);
  console.log('[sidebarStore] 文件夹已关闭');
}

/**
 * 刷新文件树
 */
export async function refreshFileTree(): Promise<void> {
  if (!sidebarState.openedFolderPath) {
    return;
  }

  sidebarState.isLoadingTree = true;
  sidebarState.treeError = null;

  try {
    sidebarState.fileTree = await loadDirectoryContents(sidebarState.openedFolderPath);
    console.log('[sidebarStore] 文件树已刷新');
  } catch (error) {
    const errorMsg = error?.toString() || '未知错误';
    sidebarState.treeError = errorMsg;
    console.error('[sidebarStore] 刷新文件树失败:', errorMsg);
  } finally {
    sidebarState.isLoadingTree = false;
  }
}

/**
 * 切换树节点展开状态
 */
export async function toggleTreeNode(node: FileTreeNode): Promise<void> {
  if (!node.isDirectory) {
    return;
  }

  if (node.isExpanded) {
    // 折叠
    node.isExpanded = false;
    expandedNodePaths.value.delete(node.path);
  } else {
    // 展开
    node.isExpanded = true;
    expandedNodePaths.value.add(node.path);

    // 如果子节点尚未加载，则加载
    if (node.children.length === 0) {
      node.isLoading = true;
      try {
        node.children = await loadDirectoryContents(node.path, 10, 0);
      } catch (error) {
        console.error(`[sidebarStore] 加载子节点失败: ${node.path}`, error);
      } finally {
        node.isLoading = false;
      }
    }
  }

  saveExpandedNodesToStorage(expandedNodePaths.value);
}

/**
 * 在树中查找节点
 */
export function findNodeByPath(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findNodeByPath(node.children, path);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * 获取当前有效宽度（考虑折叠状态）
 */
export function getEffectiveWidth(): number {
  return sidebarState.isCollapsed ? SIDEBAR_CONFIG.collapsedWidth : sidebarState.width;
}
