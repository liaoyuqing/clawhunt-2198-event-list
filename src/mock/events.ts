import type { EventItem } from '../store/feed';
import type { TabKey } from '../config';
import { PAGE_SIZE, MOCK_PER_TAB, TYPE_OPTIONS, TAB_KEYS } from '../config';

// 仅使用虚构数据，不含任何真实个人信息或企业信息。
const TAB_TITLES: { [k: string]: string[] } = {
  enrolling: [
    '产业资源对接沙龙（第 12 期）',
    '会员企业路演日 · 智能制造专场',
    '标杆企业参访：智慧园区运营',
    '会员成长课：客户成功体系搭建',
    '秋季会员社交晚宴',
    '投融资对接会 · 早期项目专场',
    '产业链上下游供需洽谈会',
    '数字化转型主题沙龙',
  ],
  upcoming: [
    '年度会员大会筹备说明会',
    '供应链金融主题沙龙',
    '创新企业路演 · 新材料专场',
    '会员互访：冷链物流标杆',
    '管理实战训练营（两天）',
    '会员家庭日 · 亲子社交活动',
    '跨境业务合规培训',
    '产业园区招商对接会',
  ],
  review: [
    '春季产业峰会（回顾）',
    '会员企业开放日（回顾）',
    '资本对接路演（回顾）',
    '组织能力工作坊（回顾）',
    '年度答谢晚宴（回顾）',
    '海外市场拓展沙龙（回顾）',
    '知识产权专题培训（回顾）',
    '绿色低碳产业论坛（回顾）',
  ],
};

const LOCATIONS = ['会员空间 · 一层路演厅', '会员空间 · 三层会议室', '线上直播', '城市会客厅', '产业园区多功能厅'];
const STATUS: { [k: string]: string } = { enrolling: '报名中', upcoming: '即将开始', review: '已结束' };

function pad2(n: number): string { return n < 10 ? '0' + n : '' + n; }

function buildItems(tab: TabKey): EventItem[] {
  const titles = TAB_TITLES[tab] || TAB_TITLES.enrolling;
  const out: EventItem[] = [];
  for (let i = 0; i < MOCK_PER_TAB; i++) {
    const type = TYPE_OPTIONS[i % TYPE_OPTIONS.length];
    const day = 1 + (i % 28);
    out.push({
      id: tab + '-' + pad2(i + 1),
      title: titles[i % titles.length] + ' · ' + (i + 1) + '号场',
      cover: '',
      type: type.value,
      typeLabel: type.label,
      startTime: '2026-12-' + pad2(day) + ' ' + pad2(9 + (i % 9)) + ':00',
      location: LOCATIONS[i % LOCATIONS.length],
      status: STATUS[tab],
    });
  }
  return out;
}

export interface MockOptions {
  scenario?: string; // '' | 'empty-tab' | 'empty-filter' | 'error'
}

export class MockEventAdapter {
  scenario = '';
  calls: { tab: string; types: string[]; cursor: string | null }[] = [];

  setScenario(s: string): void { this.scenario = s || ''; }

  fetchEvents(query: { tab: TabKey; types: string[]; cursor: string | null; pageSize: number }) {
    this.calls.push({ tab: query.tab, types: query.types.slice(), cursor: query.cursor });
    const scenario = this.scenario;
    return new Promise<{ items: EventItem[]; nextCursor: string | null; hasMore: boolean }>((resolve, reject) => {
      setTimeout(() => {
        if (scenario === 'error') {
          reject(new Error('网络异常，请稍后重试'));
          return;
        }
        if (scenario === 'empty-tab') {
          resolve({ items: [], nextCursor: null, hasMore: false });
          return;
        }
        if (scenario === 'empty-filter' && query.types.length > 0) {
          resolve({ items: [], nextCursor: null, hasMore: false });
          return;
        }
        let all = buildItems(query.tab);
        if (query.types.length > 0) {
          const want = query.types;
          all = all.filter((it) => want.indexOf(it.type) >= 0);
        }
        const offset = query.cursor ? parseInt(query.cursor, 10) : 0;
        const size = query.pageSize || PAGE_SIZE;
        const slice = all.slice(offset, offset + size);
        const nextOffset = offset + slice.length;
        const hasMore = nextOffset < all.length;
        resolve({ items: slice, nextCursor: hasMore ? String(nextOffset) : null, hasMore });
      }, 60);
    });
  }
}

export const mockAllTabs = TAB_KEYS;
