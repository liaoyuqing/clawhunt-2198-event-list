import type { TabBucket } from '../store/feed';

export type FeedStatus = 'loading' | 'error' | 'empty-tab' | 'empty-filter' | 'list';

export interface FeedView {
  status: FeedStatus;
  emptyText: string;
  showClearFilter: boolean;
  showNoMore: boolean;
  showLoadingMore: boolean;
  items: TabBucket['items'];
}

// 把分栏状态桶归一化成模板要渲染的四种互斥状态：
//   error       网络错误（含重试按钮，不显示「没有更多了」）
//   loading     首屏加载中
//   empty-tab   该分栏暂无活动（无「清除筛选」）
//   empty-filter筛选无结果（含「清除筛选」按钮）
//   list        正常列表（hasMore=false 时底部「没有更多了」）
export function deriveView(bucket: TabBucket): FeedView {
  const items = bucket.items;
  if (bucket.error) {
    return { status: 'error', emptyText: '', showClearFilter: false, showNoMore: false, showLoadingMore: false, items };
  }
  if (bucket.loading && items.length === 0) {
    return { status: 'loading', emptyText: '', showClearFilter: false, showNoMore: false, showLoadingMore: false, items };
  }
  if (items.length === 0) {
    if (bucket.filters && bucket.filters.length > 0) {
      return { status: 'empty-filter', emptyText: '筛选无结果', showClearFilter: true, showNoMore: false, showLoadingMore: false, items };
    }
    return { status: 'empty-tab', emptyText: '该分栏暂无活动', showClearFilter: false, showNoMore: false, showLoadingMore: false, items };
  }
  return {
    status: 'list',
    emptyText: '',
    showClearFilter: false,
    showNoMore: !bucket.hasMore,
    showLoadingMore: !!bucket.loading,
    items,
  };
}
