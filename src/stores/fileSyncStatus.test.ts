import { describe, it, expect } from 'vitest';
import {
  FileSyncStatus,
  getSyncStatusText,
  getSyncStatusIcon,
  isExternallyModified,
  isConflict,
  hasUnsavedChanges,
  transitionOnEdit,
  transitionOnExternalModify,
  transitionOnSave,
  transitionOnReload,
} from './fileSyncStatus';

describe('fileSyncStatus', () => {
  describe('getSyncStatusText', () => {
    it('应返回正确的状态文本', () => {
      expect(getSyncStatusText(FileSyncStatus.SYNCED)).toBe('文件已同步');
      expect(getSyncStatusText(FileSyncStatus.EDITED)).toBe('有未保存的修改');
      expect(getSyncStatusText(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe('文件已被外部程序修改');
      expect(getSyncStatusText(FileSyncStatus.CONFLICT)).toBe('有未保存的修改且文件被外部修改');
      expect(getSyncStatusText(FileSyncStatus.UNNAMED)).toBe('新文件，尚未保存');
      expect(getSyncStatusText(FileSyncStatus.READ_ONLY)).toBe('只读文件');
    });
  });

  describe('getSyncStatusIcon', () => {
    it('应返回正确的状态图标', () => {
      expect(getSyncStatusIcon(FileSyncStatus.EDITED)).toBe('*');
      expect(getSyncStatusIcon(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe('⚠');
      expect(getSyncStatusIcon(FileSyncStatus.CONFLICT)).toBe('⚠*');
      expect(getSyncStatusIcon(FileSyncStatus.UNNAMED)).toBe('+');
      expect(getSyncStatusIcon(FileSyncStatus.READ_ONLY)).toBe('🔒');
      expect(getSyncStatusIcon(FileSyncStatus.SYNCED)).toBe('');
    });
  });

  describe('isExternallyModified', () => {
    it('应正确判断外部修改相关状态', () => {
      expect(isExternallyModified(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(true);
      expect(isExternallyModified(FileSyncStatus.CONFLICT)).toBe(true);
      expect(isExternallyModified(FileSyncStatus.SYNCED)).toBe(false);
      expect(isExternallyModified(FileSyncStatus.EDITED)).toBe(false);
      expect(isExternallyModified(FileSyncStatus.UNNAMED)).toBe(false);
      expect(isExternallyModified(FileSyncStatus.READ_ONLY)).toBe(false);
    });
  });

  describe('isConflict', () => {
    it('应正确判断冲突状态', () => {
      expect(isConflict(FileSyncStatus.CONFLICT)).toBe(true);
      expect(isConflict(FileSyncStatus.EDITED)).toBe(false);
      expect(isConflict(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(false);
      expect(isConflict(FileSyncStatus.SYNCED)).toBe(false);
    });
  });

  describe('hasUnsavedChanges', () => {
    it('应正确判断有未保存修改的状态', () => {
      expect(hasUnsavedChanges(FileSyncStatus.EDITED)).toBe(true);
      expect(hasUnsavedChanges(FileSyncStatus.CONFLICT)).toBe(true);
      expect(hasUnsavedChanges(FileSyncStatus.UNNAMED)).toBe(true);
      expect(hasUnsavedChanges(FileSyncStatus.SYNCED)).toBe(false);
      expect(hasUnsavedChanges(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(false);
      expect(hasUnsavedChanges(FileSyncStatus.READ_ONLY)).toBe(false);
    });
  });

  describe('transitionOnEdit', () => {
    it('SYNCED -> EDITED', () => {
      expect(transitionOnEdit(FileSyncStatus.SYNCED)).toBe(FileSyncStatus.EDITED);
    });

    it('EXTERNALLY_MODIFIED -> EDITED', () => {
      expect(transitionOnEdit(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(FileSyncStatus.EDITED);
    });

    it('EDITED 保持不变', () => {
      expect(transitionOnEdit(FileSyncStatus.EDITED)).toBe(FileSyncStatus.EDITED);
    });

    it('CONFLICT 保持不变', () => {
      expect(transitionOnEdit(FileSyncStatus.CONFLICT)).toBe(FileSyncStatus.CONFLICT);
    });

    it('UNNAMED 保持不变', () => {
      expect(transitionOnEdit(FileSyncStatus.UNNAMED)).toBe(FileSyncStatus.UNNAMED);
    });

    it('READ_ONLY 保持不变', () => {
      expect(transitionOnEdit(FileSyncStatus.READ_ONLY)).toBe(FileSyncStatus.READ_ONLY);
    });
  });

  describe('transitionOnExternalModify', () => {
    it('SYNCED -> EXTERNALLY_MODIFIED', () => {
      expect(transitionOnExternalModify(FileSyncStatus.SYNCED)).toBe(FileSyncStatus.EXTERNALLY_MODIFIED);
    });

    it('EDITED -> CONFLICT', () => {
      expect(transitionOnExternalModify(FileSyncStatus.EDITED)).toBe(FileSyncStatus.CONFLICT);
    });

    it('EXTERNALLY_MODIFIED 保持不变', () => {
      expect(transitionOnExternalModify(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(FileSyncStatus.EXTERNALLY_MODIFIED);
    });

    it('CONFLICT 保持不变', () => {
      expect(transitionOnExternalModify(FileSyncStatus.CONFLICT)).toBe(FileSyncStatus.CONFLICT);
    });

    it('UNNAMED 保持不变', () => {
      expect(transitionOnExternalModify(FileSyncStatus.UNNAMED)).toBe(FileSyncStatus.UNNAMED);
    });

    it('READ_ONLY 保持不变', () => {
      expect(transitionOnExternalModify(FileSyncStatus.READ_ONLY)).toBe(FileSyncStatus.READ_ONLY);
    });
  });

  describe('transitionOnSave', () => {
    it('EDITED -> SYNCED', () => {
      expect(transitionOnSave(FileSyncStatus.EDITED)).toBe(FileSyncStatus.SYNCED);
    });

    it('EXTERNALLY_MODIFIED -> SYNCED', () => {
      expect(transitionOnSave(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(FileSyncStatus.SYNCED);
    });

    it('CONFLICT -> SYNCED', () => {
      expect(transitionOnSave(FileSyncStatus.CONFLICT)).toBe(FileSyncStatus.SYNCED);
    });

    it('UNNAMED -> SYNCED (首次保存)', () => {
      expect(transitionOnSave(FileSyncStatus.UNNAMED)).toBe(FileSyncStatus.SYNCED);
    });

    it('SYNCED 保持不变', () => {
      expect(transitionOnSave(FileSyncStatus.SYNCED)).toBe(FileSyncStatus.SYNCED);
    });

    it('READ_ONLY 保持不变', () => {
      expect(transitionOnSave(FileSyncStatus.READ_ONLY)).toBe(FileSyncStatus.READ_ONLY);
    });
  });

  describe('transitionOnReload', () => {
    it('任何状态重新加载后都变为 SYNCED', () => {
      expect(transitionOnReload(FileSyncStatus.EDITED)).toBe(FileSyncStatus.SYNCED);
      expect(transitionOnReload(FileSyncStatus.EXTERNALLY_MODIFIED)).toBe(FileSyncStatus.SYNCED);
      expect(transitionOnReload(FileSyncStatus.CONFLICT)).toBe(FileSyncStatus.SYNCED);
      expect(transitionOnReload(FileSyncStatus.SYNCED)).toBe(FileSyncStatus.SYNCED);
      expect(transitionOnReload(FileSyncStatus.UNNAMED)).toBe(FileSyncStatus.SYNCED);
      expect(transitionOnReload(FileSyncStatus.READ_ONLY)).toBe(FileSyncStatus.SYNCED);
    });
  });

  describe('状态转换场景测试', () => {
    it('正常编辑保存流程: SYNCED -> EDITED -> SYNCED', () => {
      let status = FileSyncStatus.SYNCED;
      status = transitionOnEdit(status);
      expect(status).toBe(FileSyncStatus.EDITED);
      status = transitionOnSave(status);
      expect(status).toBe(FileSyncStatus.SYNCED);
    });

    it('外部修改后保存: SYNCED -> EXTERNALLY_MODIFIED -> SYNCED', () => {
      let status = FileSyncStatus.SYNCED;
      status = transitionOnExternalModify(status);
      expect(status).toBe(FileSyncStatus.EXTERNALLY_MODIFIED);
      status = transitionOnSave(status);
      expect(status).toBe(FileSyncStatus.SYNCED);
    });

    it('编辑后外部修改产生冲突: SYNCED -> EDITED -> CONFLICT', () => {
      let status = FileSyncStatus.SYNCED;
      status = transitionOnEdit(status);
      expect(status).toBe(FileSyncStatus.EDITED);
      status = transitionOnExternalModify(status);
      expect(status).toBe(FileSyncStatus.CONFLICT);
    });

    it('冲突后保存解决: CONFLICT -> SYNCED', () => {
      let status = FileSyncStatus.CONFLICT;
      status = transitionOnSave(status);
      expect(status).toBe(FileSyncStatus.SYNCED);
    });

    it('冲突后重新加载解决: CONFLICT -> SYNCED', () => {
      let status = FileSyncStatus.CONFLICT;
      status = transitionOnReload(status);
      expect(status).toBe(FileSyncStatus.SYNCED);
    });

    it('新文件首次保存: UNNAMED -> SYNCED', () => {
      let status = FileSyncStatus.UNNAMED;
      status = transitionOnEdit(status); // 编辑不改变状态
      expect(status).toBe(FileSyncStatus.UNNAMED);
      status = transitionOnSave(status); // 保存后变为 SYNCED
      expect(status).toBe(FileSyncStatus.SYNCED);
    });
  });
});
