// 全局常量：分栏、筛选项、分页与阈值。小程序与单元测试共用同一份定义。
export type TabKey = 'enrolling' | 'upcoming' | 'review';

export interface TabMeta {
  key: TabKey;
  label: string;
}

// 顶部 t-tabs 三个分栏
export const TABS: TabMeta[] = [
  { key: 'enrolling', label: '报名中' },
  { key: 'upcoming', label: '即将开始' },
  { key: 'review', label: '精彩回顾' },
];

export const TAB_KEYS: TabKey[] = TABS.map((t) => t.key);

export interface TypeMeta {
  value: string;
  label: string;
}

// 类型筛选（不含「全部」，「全部」为清空动作）
export const TYPE_OPTIONS: TypeMeta[] = [
  { value: 'theme_salon', label: '主题沙龙' },
  { value: 'roadshow', label: '路演对接' },
  { value: 'company_visit', label: '企业参访' },
  { value: 'training', label: '培训课程' },
  { value: 'social', label: '社交活动' },
];

export const ALL_TYPES = TYPE_OPTIONS.map((t) => t.value);

export function typeLabel(value: string): string {
  const hit = TYPE_OPTIONS.find((t) => t.value === value);
  return hit ? hit.label : value;
}

// 分页
export const PAGE_SIZE = 10;
export const MOCK_PER_TAB = 25;
export const REACH_BOTTOM_THRESHOLD = 200;
export const FILTER_DEBOUNCE_MS = 300;
export const EVENTS_API = '/api/mini/events';
export const LOADING_TEXT = '加载中…';
export const NO_MORE_TEXT = '没有更多了';
