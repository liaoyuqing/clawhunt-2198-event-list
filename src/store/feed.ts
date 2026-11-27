import type { TabKey } from '../config';
import { TAB_KEYS } from '../config';

export interface EventItem {
  id: string;
  title: string;
  cover: string;
  type: string;
  typeLabel: string;
  startTime: string;
  location: string;
  status: string;
}

export interface EventQuery {
  tab: TabKey;
  types: string[];
  cursor: string | null;
  pageSize: number;
}

export interface EventPage {
  items: EventItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

// 每个分栏一套完全独立的状态桶：数据、游标、筛选、滚动位置与四态标志互不影响。
export interface TabBucket {
  items: EventItem[];
  cursor: string | null;
  filters: string[];
  scrollTop: number;
  loaded: boolean;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  gen: number;
}

export function createBucket(): TabBucket {
  return {
    items: [],
    cursor: null,
    filters: [],
    scrollTop: 0,
    loaded: false,
    loading: false,
    hasMore: true,
    error: null,
    gen: 0,
  };
}

export function createBuckets(): { [k in TabKey]: TabBucket } {
  const out = {} as { [k in TabKey]: TabBucket };
  TAB_KEYS.forEach((k) => { out[k] = createBucket(); });
  return out;
}

// 筛选变化时清空数据与游标、回到顶部，再按新参数拉第一页（不允许在旧游标上追加）。
export function resetForFilter(bucket: TabBucket, filters: string[]): void {
  bucket.filters = filters.slice();
  bucket.items = [];
  bucket.cursor = null;
  bucket.scrollTop = 0;
  bucket.loaded = false;
  bucket.loading = false;
  bucket.hasMore = true;
  bucket.error = null;
}

export function sameFilters(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
