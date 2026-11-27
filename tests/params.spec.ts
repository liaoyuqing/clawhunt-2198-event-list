import { describe, it, expect } from 'vitest';
import { parseRouteState, buildSharePath, buildShareQuery } from '../src/utils/params';

describe('params: 路由参数解析与分享参数生成', () => {
  it('缺省参数回退默认分栏与空筛选', () => {
    expect(parseRouteState({})).toEqual({ tab: 'enrolling', types: [] });
  });

  it('解析合法 tab 与逗号分隔的 types（保序）', () => {
    const s = parseRouteState({ tab: 'upcoming', types: 'theme_salon,roadshow' });
    expect(s.tab).toBe('upcoming');
    expect(s.types).toEqual(['theme_salon', 'roadshow']);
  });

  it('非法 tab 回退默认分栏，非法类型被过滤', () => {
    const s = parseRouteState({ tab: 'unknown', types: 'theme_salon,xxx,roadshow' });
    expect(s.tab).toBe('enrolling');
    expect(s.types).toEqual(['theme_salon', 'roadshow']);
  });

  it('重复类型去重', () => {
    const s = parseRouteState({ types: 'training,training,social' });
    expect(s.types).toEqual(['training', 'social']);
  });

  it('分享 path 同时带 tab 与 types（逗号不二次编码）', () => {
    const path = buildSharePath({ tab: 'upcoming', types: ['theme_salon', 'roadshow'] });
    expect(path).toBe('/pages/event/list?tab=upcoming&types=theme_salon,roadshow');
    // 反例守卫：不能出现 %2C 二次编码
    expect(path.indexOf('%2C') < 0).toBe(true);
  });

  it('types 为空时分享 query 不出现空 types 参数', () => {
    expect(buildShareQuery({ tab: 'review', types: [] })).toBe('tab=review');
  });
});
