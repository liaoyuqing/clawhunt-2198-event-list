Page({
  data: { id: '' },
  onLoad(query: { id?: string }) {
    this.setData({ id: (query && query.id) || '' });
  },
});
