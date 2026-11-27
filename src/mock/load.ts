import { MockEventAdapter } from './events';

export interface MockScenario {
  scenario: string;
  types: string[];
}

// 解析页面 query 中的 mock 调试场景，仅用于在开发者工具里复现四种状态。
//   mock=empty-tab     该分栏暂无活动
//   mock=empty-filter  筛选无结果（需配合 types）
//   mock=error         网络错误
//   mock=list          正常列表
export function parseMockScenario(options: any): MockScenario {
  const opt = options || {};
  const scenario = typeof opt.mock === 'string' ? opt.mock : '';
  return { scenario, types: [] };
}

export function createMockAdapter(scenario: string): MockEventAdapter {
  const adapter = new MockEventAdapter();
  adapter.setScenario(scenario);
  return adapter;
}
