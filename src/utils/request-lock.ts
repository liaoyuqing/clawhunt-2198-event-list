import type { TabKey } from '../config';

export type RequestKind = 'first' | 'more' | 'refresh';

interface LockEntry {
  kind: RequestKind;
  seq: number;
}

// 触底与下拉共用的一把闸门。
//   - 同一分栏同一时刻只允许一个在途请求：acquire 返回 false 时调用方必须直接 return，不发起请求。
//   - 不同分栏之间互相独立：一个分栏在途不影响另一个分栏。
//   - 提供 pendingTabs()，让下拉刷新的全局遮罩只在本分栏加载时出现。
export class RequestLock {
  private locks: { [tab: string]: LockEntry } = {};
  private seq = 0;

  acquire(tab: TabKey, kind: RequestKind): boolean {
    if (this.locks[tab]) {
      return false;
    }
    this.seq += 1;
    this.locks[tab] = { kind, seq: this.seq };
    return true;
  }

  release(tab: TabKey): void {
    delete this.locks[tab];
  }

  isBusy(tab: TabKey): boolean {
    return !!this.locks[tab];
  }

  pendingTabs(): TabKey[] {
    return Object.keys(this.locks) as TabKey[];
  }

  // 测试与页面重置用
  reset(): void {
    this.locks = {};
    this.seq = 0;
  }
}
