// 双列瀑布流容器：本单承接 pages/event/list 的活动卡片渲染。
// 契约（props）：items: EventItem[]；事件：cardtap(detail: { id })。
// 正式瀑布流实现由另单交付，本容器保持同一契约，替换时不改页面逻辑。
Component({
  properties: {
    items: { type: Array, value: [] },
  },
  data: {
    left: [] as any[],
    right: [] as any[],
  },
  observers: {
    items(this: any, val: any[]) {
      const left: any[] = [];
      const right: any[] = [];
      (val || []).forEach((it: any, i: number) => {
        if (i % 2 === 0) left.push(it);
        else right.push(it);
      });
      this.setData({ left, right });
    },
  },
  methods: {
    onTap(e: any) {
      const id = e && e.currentTarget ? e.currentTarget.dataset.id : '';
      this.triggerEvent('cardtap', { id });
    },
  },
});
