# clawhunt-2198-event-list

会员空间平台 · 微信小程序活动列表页 `pages/event/list`：三分栏独立状态、横向多选类型筛选、下拉刷新与触底分页、分享参数恢复。

- 技术栈：微信原生小程序 + TypeScript + TDesign 小程序组件（`tdesign-miniprogram`）
- 数据来源：本单以接口桩（mock）先行，`GET /api/mini/events` 契约已在 README 写明对接点
- 双列瀑布流：`components/event-waterfall` 按范围约定由另单实现，本仓库包含一个遵循同一契约的容器组件承接列表渲染；替换真正实现时不改页面逻辑

## 1. 依赖与运行环境

| 项 | 要求 |
| --- | --- |
| Node.js | 18 及以上（实测 v26.13.1） |
| npm | 9 及以上（实测 11.20.0） |
| 微信开发者工具 | 稳定版（实测基础库 3.5.0 / WeChatLib 3.18.1） |

```bash
# 1) 安装依赖（含 tdesign-miniprogram 与 typescript / vitest）
npm install

# 2) 一键构建小程序产物（tsc 编译 TS -> miniprogram/，复制 wxml/wxss/json，复制 tdesign 到 miniprogram_npm）
npm run build
# 预期输出：
#   [build] copied 12 static assets to miniprogram/
#   [build] tdesign-miniprogram -> miniprogram/miniprogram_npm/tdesign-miniprogram

# 3) 类型检查（EXIT=0）
npm run typecheck

# 4) 单元测试（EXIT=0，2 个测试文件 / 25 个用例全部通过）
npm test
```

**用微信开发者工具预览**：导入本目录（仓库根目录，`project.config.json` 已就位），编译后即可在模拟器查看 `pages/event/list`。AppID 使用仓库中 `project.config.json` 配置的测试号；本工程不依赖后端与任何密钥，数据由本地接口桩提供。

## 2. 目录结构

```
.
├─ src/                        # TypeScript 源码（页面 + 状态机 + 工具，可脱离 wx 单测）
│  ├─ config.ts                # 分栏、筛选项、分页与阈值常量
│  ├─ store/feed.ts            # 每分栏独立状态桶 {items,cursor,filters,scrollTop,loaded,loading,hasMore,error}
│  ├─ store/view.ts            # 四态派生（loading/error/empty-tab/empty-filter/list）
│  ├─ controller/feed-controller.ts  # 全部状态与请求行为（首屏去重、筛选重置、触底闸门）——纯逻辑，可注入适配器
│  ├─ utils/request-lock.ts    # 触底与下拉共用闸门 acquire/release
│  ├─ utils/params.ts          # 路由参数解析与分享 path 生成
│  ├─ utils/debounce.ts        # 筛选防抖
│  ├─ api/wx-adapter.ts        # 页面侧适配器：EventQuery -> GET /api/mini/events 参数
│  ├─ mock/events.ts           # 每分栏 25 条虚构数据、每页 10 条、四态场景
│  ├─ components/event-waterfall/  # 双列瀑布流容器（承接列表渲染）
│  └─ pages/event/list.*       # 活动列表页（t-tabs + 筛选条 + 瀑布流 + 四态插槽）
├─ tests/                      # vitest 单元测试（params 6 + feed-controller 19）
├─ scripts/                    # 构建辅助：copy-assets / copy-tdesign
├─ docs/checks/                # 测试原始日志
├─ docs/screenshots/           # 模拟器真截图
├─ project.config.json         # 小程序工程配置（miniprogramRoot=miniprogram/）
└─ README.md
```

## 3. 接口对接点（`GET /api/mini/events`）

页面侧 `src/api/wx-adapter.ts` 的 `buildRequestUrl` 已固化查询参数契约：

| 参数 | 说明 |
| --- | --- |
| `tab` | 分栏：`enrolling` / `upcoming` / `review` |
| `types` | 类型筛选，逗号分隔，如 `theme_salon,roadshow`；不选则不带该参数 |
| `cursor` | 翻页游标 `next_cursor`；首页不带 |
| `page_size` | 每页条数（默认 10） |

响应：`{ items: EventItem[], next_cursor: string | null }`，`next_cursor` 为空表示没有更多。

## 4. 测试

```bash
npm test
```

覆盖：路由参数解析与分享 path（6）、三分栏首屏去重（3）、多选筛选 types 拼接与游标重置（5）、触底闸门去重（6）、四态派生（4）、分享恢复（1），共 **2 个文件 / 25 个用例**。原始日志见 `docs/checks/`。

## 5. 关键行为

- **首屏只请求一次**：分栏 `loaded===true` 且无 error 时切回不重复请求，仅恢复滚动位置。
- **筛选重置游标**：筛选变更立即清空该分栏 items、`cursor=null`、回顶部，防抖 300ms 后按新参数拉第一页。
- **触底去重**：`onReachBottom` 走 `RequestLock.acquire(tab,'more')`，同一分栏在途时直接 return；距底 200px 触发（页面配置 `onReachBottomDistance=200`）。
- **四态**：空分栏「该分栏暂无活动」/ 筛选无结果「筛选无结果」+清除筛选 / 网络错误「网络错误，请稍后重试」+点击重试 / 没有更多「没有更多了」。
- **分享恢复**：`onShareAppMessage` 把 `tab` 与 `types` 写进 path（逗号不二次编码），对方打开按同一视图恢复。
