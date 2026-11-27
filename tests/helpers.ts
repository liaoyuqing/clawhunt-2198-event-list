import type { EventItem, EventPage, EventQuery } from '../src/store/feed';

export interface RecordedCall {
  tab: string;
  types: string[];
  cursor: string | null;
}

// 可控的假适配器：记录每次请求的参数，并允许测试手动 resolve/reject，
// 便于构造「请求尚未返回时又发生一次触底」的并发场景。
export class FakeAdapter {
  calls: RecordedCall[] = [];
  pending: { query: EventQuery; resolve: (p: EventPage) => void; reject: (e: any) => void }[] = [];
  autoResolve = true;
  pageSize = 10;
  totalPerTab = 25;

  fetchEvents(query: EventQuery): Promise<EventPage> {
    this.calls.push({ tab: query.tab, types: query.types.slice(), cursor: query.cursor });
    if (this.autoResolve) {
      return Promise.resolve(this.makePage(query));
    }
    return new Promise<EventPage>((resolve, reject) => {
      this.pending.push({ query, resolve, reject });
    });
  }

  makePage(query: EventQuery): EventPage {
    const offset = query.cursor ? parseInt(query.cursor, 10) : 0;
    const size = query.pageSize || this.pageSize;
    const items: EventItem[] = [];
    for (let i = offset; i < Math.min(offset + size, this.totalPerTab); i++) {
      items.push({
        id: query.tab + '-' + i,
        title: 'item ' + i,
        cover: '',
        type: 'theme_salon',
        typeLabel: '主题沙龙',
        startTime: '2026-12-01 09:00',
        location: 'x',
        status: 'y',
      });
    }
    const next = offset + items.length;
    const hasMore = next < this.totalPerTab;
    return { items, nextCursor: hasMore ? String(next) : null, hasMore };
  }

  flush(index = 0, page?: EventPage): void {
    const p = this.pending[index];
    if (!p) return;
    p.resolve(page || this.makePage(p.query));
    this.pending.splice(index, 1);
  }

  failAll(err: any): void {
    this.pending.forEach((p) => p.reject(err));
    this.pending = [];
  }
}

export function tick(ms = 0): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
