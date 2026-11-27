import type { TabKey } from '../config';
import { PAGE_SIZE, REACH_BOTTOM_THRESHOLD, FILTER_DEBOUNCE_MS, TAB_KEYS } from '../config';
import type { EventPage, EventQuery, TabBucket } from '../store/feed';
import { createBuckets, resetForFilter, sameFilters } from '../store/feed';
import { RequestLock, RequestKind } from '../utils/request-lock';
import { parseRouteState, FeedRouteState } from '../utils/params';
import { debounce, Debounced } from '../utils/debounce';

// 数据适配器：页面注入真实 wx.request 版，单元测试注入 fake 版。
// 只负责取数，不关心状态机，便于断言请求参数。
export interface FeedAdapter {
  fetchEvents(query: EventQuery): Promise<EventPage>;
}

export interface FeedControllerDeps {
  adapter: FeedAdapter;
  lock?: RequestLock;
  log?: (line: string) => void;
  onChange?: (tab: TabKey, bucket: TabBucket) => void;
  filtersDebounceMs?: number;
}

// 活动列表页的全部状态与请求行为都收敛在这里，不依赖 wx：
//   三分栏各自独立的状态桶、首屏去重、多选筛选重置游标与防抖、触底闸门、四态派生。
export class FeedController {
  readonly lock: RequestLock;
  readonly buckets: { [k in TabKey]: TabBucket };
  currentTab: TabKey = 'enrolling';

  private adapter: FeedAdapter;
  private logFn: (line: string) => void;
  private onChange?: (tab: TabKey, bucket: TabBucket) => void;
  private filterDebouncers: { [k: string]: Debounced<[string[]]> };
  private pending: { [k: string]: Promise<boolean> };

  // 页面在下拉刷新时等待当前请求结算，再收起刷新动画。
  whenSettled(tab: TabKey): Promise<boolean> {
    return this.pending[tab] || Promise.resolve(true);
  }

  constructor(deps: FeedControllerDeps) {
    this.adapter = deps.adapter;
    this.lock = deps.lock || new RequestLock();
    this.logFn = deps.log || (() => {});
    this.onChange = deps.onChange;
    this.buckets = createBuckets();

    const wait = typeof deps.filtersDebounceMs === 'number' ? deps.filtersDebounceMs : FILTER_DEBOUNCE_MS;
    this.pending = {};
    this.filterDebouncers = {};
    TAB_KEYS.forEach((tab) => {
      this.filterDebouncers[tab] = debounce((types: string[]) => {
        this.loadFirst(tab);
      }, wait);
    });
  }

  private log(line: string): void {
    this.logFn(line);
  }

  private emit(tab: TabKey): void {
    if (this.onChange) this.onChange(tab, this.buckets[tab]);
  }

  bucket(tab: TabKey): TabBucket {
    return this.buckets[tab];
  }

  // onLoad：解析路由参数（分享进入），写入首屏分栏的筛选后拉第一页。
  init(options: any): FeedRouteState {
    const state = parseRouteState(options);
    this.currentTab = state.tab;
    const b = this.buckets[state.tab];
    if (state.types.length > 0) {
      b.filters = state.types.slice();
    }
    this.loadFirst(state.tab);
    return state;
  }

  // 切换分栏：已加载且无错误的分栏不重复请求，只恢复其滚动位置。
  switchTab(tab: TabKey): void {
    if (tab === this.currentTab) return;
    this.currentTab = tab;
    const b = this.buckets[tab];
    if (b.loaded && !b.error) {
      this.log('[feed] switch tab=' + tab + ' cached loaded=true skip request');
      this.emit(tab);
      return;
    }
    this.loadFirst(tab);
  }

  // 多选筛选变更：立即重置该分栏游标与数据、清空列表，再防抖后拉第一页。
  selectFilter(tab: TabKey, types: string[]): void {
    const b = this.buckets[tab];
    if (sameFilters(b.filters, types)) return;
    resetForFilter(b, types);
    this.log('[feed] filter tab=' + tab + ' types=' + (types.join(',') || '') + ' -> reset cursor');
    this.emit(tab);
    this.filterDebouncers[tab](types);
  }

  clearFilter(tab: TabKey): void {
    this.selectFilter(tab, []);
  }

  // 首屏/筛选后第一页：kind=first，游标置空。
  loadFirst(tab: TabKey): boolean {
    return this.fetch(tab, 'first', null);
  }

  // 下拉刷新：kind=refresh，游标置空，成功后用第一页替换列表。
  refresh(tab: TabKey): boolean {
    return this.fetch(tab, 'refresh', null);
  }

  // 触底加载：先按距底阈值判定，再走闸门；hasMore=false 时不再请求。
  reachBottom(tab: TabKey, scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
    const distance = scrollHeight - scrollTop - clientHeight;
    if (distance > REACH_BOTTOM_THRESHOLD) {
      return false;
    }
    return this.loadMore(tab);
  }

  loadMore(tab: TabKey): boolean {
    const b = this.buckets[tab];
    if (!b.loaded || !b.hasMore) {
      this.log('[feed] skip tab=' + tab + ' kind=more no-more');
      return false;
    }
    return this.fetch(tab, 'more', b.cursor);
  }

  retry(tab: TabKey): boolean {
    const b = this.buckets[tab];
    b.error = null;
    return this.loadFirst(tab);
  }

  private fetch(tab: TabKey, kind: RequestKind, cursor: string | null): boolean {
    const b = this.buckets[tab];
    if (!this.lock.acquire(tab, kind)) {
      this.log('[feed] skip tab=' + tab + ' kind=' + kind + ' busy');
      return false;
    }
    const gen = b.gen;
    b.loading = true;
    if (kind !== 'more') {
      b.error = null;
    }
    const query: EventQuery = {
      tab,
      types: b.filters.slice(),
      cursor: kind === 'more' ? cursor : null,
      pageSize: PAGE_SIZE,
    };
    this.log(
      '[feed] request tab=' + tab +
      ' kind=' + kind +
      ' types=' + (query.types.join(',') || '') +
      ' cursor=' + (query.cursor === null ? 'null' : query.cursor)
    );
    this.emit(tab);

    const promise = this.adapter
      .fetchEvents(query)
      .then((page) => {
        if (b.gen !== gen) {
          return false;
        }
        const items = kind === 'more' ? b.items.concat(page.items) : page.items;
        b.items = items;
        b.cursor = page.nextCursor;
        b.hasMore = page.hasMore;
        b.loaded = true;
        b.loading = false;
        b.error = null;
        this.emit(tab);
        return true;
      })
      .catch((err: any) => {
        if (b.gen !== gen) {
          return false;
        }
        b.loading = false;
        b.error = (err && err.message) || '网络错误';
        this.emit(tab);
        return false;
      })
      .then((ok) => {
        this.lock.release(tab);
        return ok;
      });
    this.pending[tab] = promise;
    return true;
  }

  setScrollTop(tab: TabKey, value: number): void {
    this.buckets[tab].scrollTop = value;
  }

  snapshot(): { currentTab: TabKey; buckets: { [k in TabKey]: TabBucket } } {
    return { currentTab: this.currentTab, buckets: this.buckets };
  }

  dispose(): void {
    TAB_KEYS.forEach((tab) => {
      if (this.filterDebouncers[tab]) this.filterDebouncers[tab].cancel();
    });
  }
}
