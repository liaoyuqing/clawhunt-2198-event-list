import { TAB_KEYS, ALL_TYPES, TabKey } from '../config';

export interface FeedRouteState {
  tab: TabKey;
  types: string[];
}

export const DEFAULT_TAB: TabKey = 'enrolling';

// 解析 / 合并页面参数（onLoad 与 onShareAppMessage 共用同一套归一化逻辑）。
// options 里 tab 非法回退默认分栏；types 支持 'a,b' 或 ['a','b']，过滤非法值、去重、保序。
export function parseRouteState(options: any): FeedRouteState {
  const opt = options || {};
  const tabRaw = Array.isArray(opt.tab) ? opt.tab[0] : opt.tab;
  const tab: TabKey = TAB_KEYS.indexOf(tabRaw) >= 0 ? (tabRaw as TabKey) : DEFAULT_TAB;

  let typesRaw: any = opt.types;
  if (Array.isArray(typesRaw)) {
    typesRaw = typesRaw.join(',');
  }
  const seen: { [k: string]: boolean } = {};
  const types: string[] = [];
  if (typeof typesRaw === 'string' && typesRaw.length > 0) {
    typesRaw.split(',').forEach((raw: string) => {
      const v = raw.trim();
      if (ALL_TYPES.indexOf(v) >= 0 && !seen[v]) {
        seen[v] = true;
        types.push(v);
      }
    });
  }
  return { tab, types };
}

// 生成分享参数：始终带 tab；types 为空时不出现 types= 空参数。
export function buildShareQuery(state: FeedRouteState): string {
  // tab 与 types 都是安全字符（字母/数字/下划线/逗号），直接拼接，避免把逗号二次编码成 %2C
  // 导致对方解析后只剩一项（AC5 反例 double encoded）。
  const parts: string[] = [];
  parts.push('tab=' + state.tab);
  if (state.types.length > 0) {
    parts.push('types=' + state.types.join(','));
  }
  return parts.join('&');
}

// 生成分享 path（用于 onShareAppMessage 返回值）
export function buildSharePath(state: FeedRouteState): string {
  return '/pages/event/list?' + buildShareQuery(state);
}
