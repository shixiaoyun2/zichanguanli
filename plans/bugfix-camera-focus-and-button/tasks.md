# 摄像头功能修复任务清单 (Tasks)

- [ ] **任务 1：修复资产详情页拍照按钮响应**
  - [ ] 修改 `src/pages/AssetDetail.tsx`。
  - [ ] 在“去拍照”按钮的 `onClick` 中增加 `fileInputRef.current?.click()` 调用。
  - [ ] 确保“从相册选择”按钮会清除 `capture` 属性。

- [ ] **任务 2：扫码对焦增强 (Scan.tsx)**
  - [ ] 更新 `Html5QrcodeScanner` 配置，注入 `videoConstraints` 请求持续对焦。
  - [ ] 编写一个 `useEffect` 或 DOM 监听逻辑，捕获扫码器中的 `video` 元素。
  - [ ] 实现点击 `video` 时的对焦尝试逻辑（封装 `applyConstraints`）。
  - [ ] 添加点击时的对焦框动画效果（CSS + JS）。

- [ ] **任务 3：真机测试与验证**
  - [ ] 在移动设备浏览器上验证“去拍照”是否直接调起摄像头。
  - [ ] 验证扫码点击画面时是否有视觉反馈及对焦行为改善。
