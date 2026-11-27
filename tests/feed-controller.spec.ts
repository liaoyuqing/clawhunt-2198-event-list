import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedController } from '../src/controller/feed-controller';
import { FakeAdapter, tick } from './helpers';
import type { EventPage } from '../src/store/feed';

function makeCtrl(opts?: { debounce?: number }) {
  const adapter = new FakeAdapter();
  const logs: string[] = [];
  const ctrl = new FeedController({
    adapter,
    log: (l) => logs.push(l),
    filtersDebounceMs: opts && typeof opts.debounce === 'number' ? opts.debounce : 0,
  });
  return { adapter, logs, ctrl };
}

describe('AC1 三分栏来回切换，每分栏首屏只请求一次', () => {
  it('默认分栏首屏请求一次，切走再切回不重复请求', async () => {
    const { adapter, ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    expect(adapter.calls.length).toBe(1);
    expect(adapter.calls[0].tab).toBe('enrolling');

    ctrl.switchTab('upcoming');
    await tick();
    ctrl.switchTab('review');
    await tick();
    expect(adapter.calls.filter((c) => c.tab === 'upcoming').length).toBe(1);
    expect(adapter.calls.filter((c) => c.tab === 'review').length).toBe(1);

    // 再切回已加载的 enrolling：不再发请求
    ctrl.switchTab('enrolling');
    await tick();
    expect(adapter.calls.filter((c) => c.tab === 'enrolling').length).toBe(1);
    expect(ctrl.bucket('enrolling').loaded).toBe(true);
    expect(ctrl.bucket('enrolling').items.length).toBe(10);
  });

  it('三条分栏来回两轮后首屏请求总数恰好为 3', async () => {
    const { adapter, ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    ctrl.switchTab('upcoming'); await tick();
    ctrl.switchTab('review'); await tick();
    ctrl.switchTab('enrolling'); await tick();
    ctrl.switchTab('upcoming'); await tick();
    expect(adapter.calls.length).toBe(3);
  });

  it('切换分栏不串数据，滚动位置独立记录', async () => {
    const { ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    ctrl.setScrollTop('enrolling', 300);
    expect(ctrl.bucket('enrolling').scrollTop).toBe(300);
    expect(ctrl.bucket('upcoming').scrollTop).toBe(0);
  });
});

describe('AC2 选中两个类型后 types=a,b 且游标重置', () => {
  it('选择两个类型后请求 types 为逗号串且 cursor 为 null', async () => {
    const { adapter, ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    adapter.calls = [];
    ctrl.selectFilter('enrolling', ['theme_salon', 'roadshow']);
    await tick(5);
    const last = adapter.calls[adapter.calls.length - 1];
    expect(last.types.join(',')).toBe('theme_salon,roadshow');
    expect(last.cursor).toBe(null);
  });

  it('已翻到第二页后改筛选，游标被重置（请求不带旧游标）', async () => {
    const { adapter, ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    ctrl.loadMore('enrolling');
    await tick();
    expect(ctrl.bucket('enrolling').cursor).toBe('20'); // 已翻到第二页，游标推进到 20
    adapter.calls = [];
    ctrl.selectFilter('enrolling', ['training']);
    await tick(5);
    const last = adapter.calls[adapter.calls.length - 1];
    expect(last.cursor).toBe(null);
    // 新筛选的请求以空游标发起（重置），不会在旧游标 20 上追加
    expect(last.types.join(',')).toBe('training');
  });

  it('筛选变更时先清空 items，再拉新数据', async () => {
    const { ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    expect(ctrl.bucket('enrolling').items.length).toBe(10);
    ctrl.selectFilter('enrolling', ['social']);
    // 防抖窗口内旧数据已清空
    expect(ctrl.bucket('enrolling').items.length).toBe(0);
    await tick(5);
    expect(ctrl.bucket('enrolling').filters).toEqual(['social']);
  });

  it('连续点选两个类型只发一次请求（防抖合并）', async () => {
    const adapter = new FakeAdapter();
    const ctrl = new FeedController({ adapter, filtersDebounceMs: 50 });
    ctrl.init({});
    await tick();
    adapter.calls = [];
    ctrl.selectFilter('enrolling', ['theme_salon']);
    ctrl.selectFilter('enrolling', ['theme_salon', 'roadshow']);
    await tick(120);
    expect(adapter.calls.length).toBe(1);
    expect(adapter.calls[0].types.join(',')).toBe('theme_salon,roadshow');
  });

  it('选「全部」（清空）后 types 为空、cursor 归零', async () => {
    const { adapter, ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    ctrl.selectFilter('enrolling', ['theme_salon']);
    await tick(5);
    adapter.calls = [];
    ctrl.clearFilter('enrolling');
    await tick(5);
    const last = adapter.calls[adapter.calls.length - 1];
    expect(last.types.length).toBe(0);
    expect(last.cursor).toBe(null);
  });
});

describe('AC3 快速连续触底只发一次分页请求', () => {
  it('同一时刻连续触底 5 次只发 1 次分页请求', async () => {
    const adapter = new FakeAdapter();
    adapter.autoResolve = false;
    const ctrl = new FeedController({ adapter, filtersDebounceMs: 0 });
    ctrl.init({});
    adapter.flush(0); // 首屏返回
    await tick();
    adapter.calls = [];
    for (let i = 0; i < 5; i++) {
      ctrl.reachBottom('enrolling', 1000, 850, 800); // 距底 = -650 < 200，触发
    }
    // 只有一次请求进了 pending
    expect(adapter.pending.length).toBe(1);
    expect(adapter.calls.length).toBe(1);
  });

  it('首次分页请求返回前再次触底被闸门拒绝', async () => {
    const adapter = new FakeAdapter();
    adapter.autoResolve = false;
    const ctrl = new FeedController({ adapter, filtersDebounceMs: 0 });
    ctrl.init({});
    adapter.flush(0);
    await tick();
    const first = ctrl.loadMore('enrolling');
    const second = ctrl.loadMore('enrolling');
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(adapter.pending.length).toBe(1);
  });

  it('首屏返回后触底带 cursor=10，成功后游标推进', async () => {
    const adapter = new FakeAdapter();
    adapter.autoResolve = false;
    const ctrl = new FeedController({ adapter, filtersDebounceMs: 0 });
    ctrl.init({});
    adapter.flush(0);
    await tick();
    ctrl.reachBottom('enrolling', 1000, 850, 800);
    const p = adapter.pending[0];
    expect(p.query.cursor).toBe('10');
    adapter.flush(0);
    await tick();
    expect(ctrl.bucket('enrolling').items.length).toBe(20);
    expect(ctrl.bucket('enrolling').cursor).toBe('20');
  });

  it('距底不足阈值时不触发请求', async () => {
    const { adapter, ctrl } = makeCtrl();
    ctrl.init({});
    await tick();
    adapter.calls = [];
    const fired = ctrl.reachBottom('enrolling', 1000, 100, 800); // 距底 100 <200 触发? 100< 200 -> 触发
    // 用不触发场景：距底 500
    adapter.calls = [];
    const notFired = ctrl.reachBottom('enrolling', 2000, 700, 800); // 距底 500 > 200
    expect(notFired).toBe(false);
    expect(adapter.calls.length).toBe(0);
  });

  it('hasMore=false 后触底不再发请求', async () => {
    const adapter = new FakeAdapter();
    adapter.totalPerTab = 10; // 只有一页
    const ctrl = new FeedController({ adapter, filtersDebounceMs: 0 });
    ctrl.init({});
    await tick();
    expect(ctrl.bucket('enrolling').hasMore).toBe(false);
    adapter.calls = [];
    const fired = ctrl.reachBottom('enrolling', 1000, 950, 800);
    expect(fired).toBe(false);
    expect(adapter.calls.length).toBe(0);
  });

  it('请求失败后释放闸门，下次触底可重试', async () => {
    const adapter = new FakeAdapter();
    adapter.autoResolve = false;
    const ctrl = new FeedController({ adapter, filtersDebounceMs: 0 });
    ctrl.init({});
    adapter.flush(0);
    await tick();
    ctrl.loadMore('enrolling');
    adapter.failAll(new Error('boom'));
    await tick();
    expect(ctrl.lock.isBusy('enrolling')).toBe(false);
    expect(ctrl.bucket('enrolling').error).toBe('boom');
  });
});

describe('AC4 四态派生（空分栏 / 筛选无结果 / 网络错误 / 没有更多）', () => {
  it('无数据且无筛选 -> 该分栏暂无活动，不显示清除筛选', async () => {
    const { deriveView } = await import('../src/store/view');
    const v = deriveView({ items: [], cursor: null, filters: [], scrollTop: 0, loaded: true, loading: false, hasMore: false, error: null, gen: 0 });
    expect(v.status).toBe('empty-tab');
    expect(v.emptyText).toBe('该分栏暂无活动');
    expect(v.showClearFilter).toBe(false);
  });

  it('无数据且有筛选 -> 筛选无结果，显示清除筛选', async () => {
    const { deriveView } = await import('../src/store/view');
    const v = deriveView({ items: [], cursor: null, filters: ['roadshow'], scrollTop: 0, loaded: true, loading: false, hasMore: false, error: null, gen: 0 });
    expect(v.status).toBe('empty-filter');
    expect(v.showClearFilter).toBe(true);
  });

  it('有 error -> 网络错误，不显示没有更多', async () => {
    const { deriveView } = await import('../src/store/view');
    const v = deriveView({ items: [], cursor: null, filters: [], scrollTop: 0, loaded: false, loading: false, hasMore: true, error: 'x', gen: 0 });
    expect(v.status).toBe('error');
    expect(v.showNoMore).toBe(false);
  });

  it('有数据且 hasMore=false -> 显示没有更多了', async () => {
    const { deriveView } = await import('../src/store/view');
    const items = [{ id: 'a', title: 't', cover: '', type: 'x', typeLabel: 'x', startTime: '', location: '', status: '' }];
    const v = deriveView({ items, cursor: null, filters: [], scrollTop: 0, loaded: true, loading: false, hasMore: false, error: null, gen: 0 });
    expect(v.status).toBe('list');
    expect(v.showNoMore).toBe(true);
  });
});

describe('AC5 分享进入恢复分栏与筛选', () => {
  it('用分享 path 重新 onLoad 后恢复分栏与筛选，首个请求带逗号 types 且不带 cursor', async () => {
    const { buildSharePath } = await import('../src/utils/params');
    const path = buildSharePath({ tab: 'upcoming', types: ['theme_salon', 'roadshow'] });
    const query = path.split('?')[1];
    const opts: any = {};
    query.split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      opts[k] = decodeURIComponent(v);
    });
    const { adapter, ctrl } = makeCtrl();
    ctrl.init(opts);
    await tick();
    expect(ctrl.currentTab).toBe('upcoming');
    expect(ctrl.bucket('upcoming').filters).toEqual(['theme_salon', 'roadshow']);
    const first = adapter.calls[0];
    expect(first.tab).toBe('upcoming');
    expect(first.types.join(',')).toBe('theme_salon,roadshow');
    expect(first.cursor).toBe(null);
  });
});
