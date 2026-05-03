# 摄像头对焦与拍照功能修复规范 (Specs)

## 1. 资产详情页“去拍照”功能修复 (AssetDetail.tsx)
- **问题分析**：当前的 `onClick` 事件仅通过 `setAttribute` 设置了 `capture` 属性，但没有调用 `fileInputRef.current.click()`，导致点击后无任何交互。
- **解决方案**：修改点击回调，确保在设置 `capture` 属性后立即触发 `.click()`。同时，考虑到部分浏览器行为差异，在点击“相册”按钮时应显式移除 `capture` 属性。

## 2. 扫码对焦优化 (Scan.tsx)
- **自动对焦 (Auto-focus)**：
  - 在 `Html5QrcodeScanner` 的配置中，尝试增加 `videoConstraints`，请求 `focusMode: 'continuous'`。
  - 注意：Web 端对焦受限于浏览器实现，各平台表现不一。
- **手动对焦 (Manual Focus on Click)**：
  - 核心逻辑：监听 `#reader` 容器内的 `video` 元素的点击事件。
  - 使用 `MediaStreamTrack.applyConstraints()` API（如果支持）：
    - 当用户点击画面时，获取当前正在运行的视频轨道。
    - 尝试应用 `{ focusMode: 'manual', focusDistance: ... }` 或简单的重新应用当前约束以触发系统对焦。
    - 降级方案：若浏览器不支持 `applyConstraints` 的对焦控制，点击行为可配合 UI 视觉反馈（如显示对焦框）。

## 3. UI 交互反馈
- 在扫码页面点击摄像头区域时，显示一个简短的对焦框动画，提升用户感知。
