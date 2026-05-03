# 扫码器高级设置面板任务清单 (Tasks)

- [ ] **任务 1：定义设置项常量与类型**
  - 在 `src/pages/Scan.tsx` 中定义支持的格式列表及设置项的 TypeScript 接口。

- [ ] **任务 2：实现 LocalStorage 管理逻辑**
  - 编写读取和保存设置的 Helper 函数。
  - 初始化页面时加载保存的设置。

- [ ] **任务 3：构建设置模态框组件**
  - 使用 `framer-motion` (motion/react) 实现平滑的弹出效果。
  - 包含格式多选列表（Checkboxes）。
  - 包含引擎选择（Radio/Select）。

- [ ] **任务 4：动态注入扫码器配置**
  - 修改 `useEffect` 中的 `new Html5QrcodeScanner` 调用逻辑。
  - 将用户选择的 `formatsToSupport` 注入配置。
  - 设置 `useBarCodeDetectorIfSupported` 参数。

- [ ] **任务 5：添加设置入口按钮**
  - 在 Scan 页面 UI 中添加设置图标。
  - 处理点击打开模态框的逻辑。

- [ ] **任务 6：实现“应用更改”刷新逻辑**
  - 当设置保存后，如果正在扫描，需销毁当前实例并重新启动。
