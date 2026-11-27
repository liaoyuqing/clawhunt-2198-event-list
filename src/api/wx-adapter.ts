import { EVENTS_API } from '../config';
import type { EventPage, EventQuery } from '../store/feed';
import type { FeedAdapter } from '../controller/feed-controller';

// 页面侧适配器：把 EventQuery 翻译成 GET /api/mini/events 的查询参数并发起 wx.request。
// 本单后端接口以 mock 先行，真实接口就绪后只需替换 baseUrl，不改上层状态机。
// query 形如 tab=enrolling&types=theme_salon,roadshow&cursor=<next_cursor>&page_size=10
export interface WxAdapterOptions {
  baseUrl?: string;
}

export function buildRequestUrl(query: EventQuery, baseUrl: string): string {
  const parts: string[] = [];
  parts.push('tab=' + encodeURIComponent(query.tab));
  if (query.types.length > 0) {
    parts.push('types=' + encodeURIComponent(query.types.join(',')));
  }
  if (query.cursor !== null) {
    parts.push('cursor=' + encodeURIComponent(query.cursor));
  }
  parts.push('page_size=' + query.pageSize);
  const host = baseUrl || '';
  return host + EVENTS_API + '?' + parts.join('&');
}

export class WxFeedAdapter implements FeedAdapter {
  baseUrl: string;
  onRequest?: (url: string, params: any) => void;

  constructor(options?: WxAdapterOptions) {
    this.baseUrl = (options && options.baseUrl) || '';
  }

  fetchEvents(query: EventQuery): Promise<EventPage> {
    const url = buildRequestUrl(query, this.baseUrl);
    const params: any = {
      tab: query.tab,
      types: query.types.join(','),
      cursor: query.cursor,
      page_size: query.pageSize
    };
    if (this.onRequest) this.onRequest(url, params);
    return new Promise<EventPage>((resolve, reject) => {
      wx.request({
        url,
        method: 'GET',
        data: params,
        timeout: 8000,
        success(res: any) {
          const body = res && res.data ? res.data : {};
          if (body && Array.isArray(body.items)) {
            resolve({
              items: body.items,
              nextCursor: body.next_cursor == null ? null : String(body.next_cursor),
              hasMore: !!body.next_cursor
            });
          } else {
            reject(new Error('返回数据格式不正确'));
          }
        },
        fail(err: any) {
          reject(new Error((err && err.errMsg) || '网络请求失败'));
        }
      });
    });
  }
}
