/**
 * 文件同步状态
 * 表示编辑器中的内容与磁盘文件的关系
 */
export enum FileSyncStatus {
  /** 同步：编辑器内容与磁盘文件完全一致 */
  SYNCED = 'synced',

  /** 已编辑：编辑器有未保存的修改，磁盘文件未变化 */
  EDITED = 'edited',

  /** 外部修改：磁盘文件已被修改，编辑器内容未变化 */
  EXTERNALLY_MODIFIED = 'externally_modified',

  /** 冲突：编辑器有未保存修改，且磁盘文件也被修改 */
  CONFLICT = 'conflict',

  /** 未命名：新文件，尚未保存到磁盘 */
  UNNAMED = 'unnamed',

  /** 只读：远程 URL 文件，无法保存 */
  READ_ONLY = 'read_only',
}

/**
 * 获取状态的显示文本
 */
export function getSyncStatusText(status: FileSyncStatus): string {
  switch (status) {
    case FileSyncStatus.SYNCED:
      return '文件已同步';
    case FileSyncStatus.EDITED:
      return '有未保存的修改';
    case FileSyncStatus.EXTERNALLY_MODIFIED:
      return '文件已被外部程序修改';
    case FileSyncStatus.CONFLICT:
      return '有未保存的修改且文件被外部修改';
    case FileSyncStatus.UNNAMED:
      return '新文件，尚未保存';
    case FileSyncStatus.READ_ONLY:
      return '只读文件';
    default:
      return '未知状态';
  }
}

/**
 * 获取状态的图标
 */
export function getSyncStatusIcon(status: FileSyncStatus): string {
  switch (status) {
    case FileSyncStatus.EDITED:
      return '*';
    case FileSyncStatus.EXTERNALLY_MODIFIED:
      return '⚠';
    case FileSyncStatus.CONFLICT:
      return '⚠*';
    case FileSyncStatus.UNNAMED:
      return '+';
    case FileSyncStatus.READ_ONLY:
      return '🔒';
    default:
      return '';
  }
}

/**
 * 判断状态是否为外部修改相关（外部修改或冲突）
 */
export function isExternallyModified(status: FileSyncStatus): boolean {
  return status === FileSyncStatus.EXTERNALLY_MODIFIED ||
         status === FileSyncStatus.CONFLICT;
}

/**
 * 判断状态是否为冲突
 */
export function isConflict(status: FileSyncStatus): boolean {
  return status === FileSyncStatus.CONFLICT;
}

/**
 * 判断状态是否有未保存的修改（已编辑或冲突）
 */
export function hasUnsavedChanges(status: FileSyncStatus): boolean {
  return status === FileSyncStatus.EDITED ||
         status === FileSyncStatus.CONFLICT ||
         status === FileSyncStatus.UNNAMED;
}

/**
 * 状态转换：用户编辑内容
 */
export function transitionOnEdit(currentStatus: FileSyncStatus): FileSyncStatus {
  switch (currentStatus) {
    case FileSyncStatus.SYNCED:
    case FileSyncStatus.EXTERNALLY_MODIFIED:
      return FileSyncStatus.EDITED;
    case FileSyncStatus.EDITED:
    case FileSyncStatus.CONFLICT:
      return currentStatus; // 保持不变
    case FileSyncStatus.UNNAMED:
      return FileSyncStatus.UNNAMED; // 未命名文件保持未命名状态
    case FileSyncStatus.READ_ONLY:
      return FileSyncStatus.READ_ONLY; // 只读文件保持只读状态（不应该发生）
    default:
      return currentStatus;
  }
}

/**
 * 状态转换：外部修改文件
 */
export function transitionOnExternalModify(currentStatus: FileSyncStatus): FileSyncStatus {
  switch (currentStatus) {
    case FileSyncStatus.SYNCED:
      return FileSyncStatus.EXTERNALLY_MODIFIED;
    case FileSyncStatus.EDITED:
      return FileSyncStatus.CONFLICT;
    case FileSyncStatus.EXTERNALLY_MODIFIED:
    case FileSyncStatus.CONFLICT:
      return currentStatus; // 保持不变
    case FileSyncStatus.UNNAMED:
      return FileSyncStatus.UNNAMED; // 未命名文件不存在外部修改
    case FileSyncStatus.READ_ONLY:
      return FileSyncStatus.READ_ONLY; // 只读文件
    default:
      return currentStatus;
  }
}

/**
 * 状态转换：保存文件
 */
export function transitionOnSave(currentStatus: FileSyncStatus): FileSyncStatus {
  switch (currentStatus) {
    case FileSyncStatus.EDITED:
    case FileSyncStatus.EXTERNALLY_MODIFIED:
    case FileSyncStatus.CONFLICT:
      return FileSyncStatus.SYNCED;
    case FileSyncStatus.UNNAMED:
      return FileSyncStatus.SYNCED; // 首次保存后变为同步状态
    case FileSyncStatus.SYNCED:
    case FileSyncStatus.READ_ONLY:
      return currentStatus; // 保持不变
    default:
      return currentStatus;
  }
}

/**
 * 状态转换：重新加载文件
 */
export function transitionOnReload(_currentStatus: FileSyncStatus): FileSyncStatus {
  // 重新加载后，文件内容与磁盘一致
  return FileSyncStatus.SYNCED;
}
