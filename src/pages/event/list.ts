import { TABS, TYPE_OPTIONS, TabKey } from '../../config';
import { FeedController } from '../../controller/feed-controller';
import { deriveView } from '../../store/view';
import { MockEventAdapter } from '../../mock/events';
import { WxFeedAdapter } from '../../api/wx-adapter';
import { parseMockScenario } from '../../mock/load';
import { buildSharePath } from '../../utils/params';

// 活动列表页：三分栏独立状态 + 多选筛选 + 下拉刷新/触底分页 + 分享参数恢复。
// 页面只做渲染与事件转发，全部状态与请求行为都在 FeedController 里（可脱离 wx 单测）。

type Mode = 'mock' | 'api';

interface PageQuery {
  tab?: string;
  types?: string;
  mock?: string;
}

Page({
  data: {
    tabs: TABS,
    currentTab: 'enrolling' as TabKey,
    currentFilters: [] as string[],
    typeOptions: [] as { value: string; label: string; selected: boolean }[],
    panels: [] as any[],
  },

  controller: null as any,
  mode: 'mock' as Mode,

  onLoad(query: PageQuery) {
    // 本单后端以 mock 先行；联调时把 mode 换成 'api' 并配置 baseUrl 即可。
    this.mode = 'mock';
    const mockInfo = parseMockScenario(query);
    let adapter: any;
    if (this.mode === 'mock') {
      adapter = new MockEventAdapter();
      adapter.setScenario(mockInfo.scenario);
    } else {
      adapter = new WxFeedAdapter({ baseUrl: '' });
    }
    this.controller = new FeedController({
      adapter,
      log: (line: string) => {
        console.log(line);
        const self: any = this;
        if (!self.__feedLog) self.__feedLog = [];
        self.__feedLog.push(line);
      },
      onChange: () => this.render(),
    });
    this.controller.init(query);
    this.render();
  },

  onShow() {
    // 只刷新渲染，不重拉首屏：已加载分栏保持各自数据、游标与滚动位置（AC1）。
  },

  onPageScroll(e: { scrollTop: number }) {
    if (!this.controller) return;
    this.controller.setScrollTop(this.controller.currentTab, e.scrollTop);
  },

  onPullDownRefresh() {
    const tab: TabKey = this.controller.currentTab;
    this.controller.refresh(tab);
    this.controller.whenSettled(tab).then(() => {
      wx.stopPullDownRefresh();
      this.render();
    });
  },

  onReachBottom() {
    // 距底 200px 由页面配置 onReachBottomDistance=200 保证；此处只走闸门加载下一页，
    // 连续触底由 RequestLock 去重（AC3）。
    const tab: TabKey = this.controller.currentTab;
    this.controller.loadMore(tab);
  },

  onTabsChange(e: any) {
    const tab: TabKey = e && e.detail ? e.detail.value : (e && e.target ? e.target.dataset.value : null);
    if (!tab) return;
    this.controller.switchTab(tab);
    this.render();
    const b = this.controller.bucket(tab);
    wx.pageScrollTo({ scrollTop: b.scrollTop || 0, duration: 0 });
  },

  onTapType(e: any) {
    const value = e.currentTarget.dataset.value;
    const tab: TabKey = this.controller.currentTab;
    const current: string[] = this.controller.bucket(tab).filters.slice();
    const idx = current.indexOf(value);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(value);
    this.controller.selectFilter(tab, current);
    this.render();
  },

  onTapAll() {
    const tab: TabKey = this.controller.currentTab;
    this.controller.clearFilter(tab);
    this.render();
  },

  onClearFilter(e: any) {
    const tab: TabKey = (e && e.currentTarget && e.currentTarget.dataset.tab) || this.controller.currentTab;
    this.controller.clearFilter(tab);
    this.render();
  },

  onRetry(e: any) {
    const tab: TabKey = (e && e.currentTarget && e.currentTarget.dataset.tab) || this.controller.currentTab;
    this.controller.retry(tab);
    this.render();
  },

  onCardTap(e: any) {
    const id = e && e.detail ? e.detail.id : '';
    if (!id) return;
    wx.navigateTo({ url: '/pages/event/detail?id=' + encodeURIComponent(id) });
  },

  // 分享：把当前分栏与筛选写进路径，对方打开看到同一视图。
  onShareAppMessage() {
    const state = { tab: this.controller.currentTab, types: this.controller.bucket(this.controller.currentTab).filters };
    const path = buildSharePath(state);
    console.log('[feed] share path=' + path);
    return { title: '会员活动', path };
  },

  render() {
    const ctrl = this.controller;
    const currentTab: TabKey = ctrl.currentTab;
    const currentFilters: string[] = ctrl.bucket(currentTab).filters.slice();
    const typeOptions = TYPE_OPTIONS.map((t) => ({
      value: t.value,
      label: t.label,
      selected: currentFilters.indexOf(t.value) >= 0,
    }));
    const panels = TABS.map((t) => {
      const b = ctrl.bucket(t.key);
      return { key: t.key, label: t.label, items: b.items, view: deriveView(b) };
    });
    this.setData({ currentTab, currentFilters, typeOptions, panels });
  },
});
