# 扫码器重构任务清单 (Tasks) - v2

- [x] **任务 0：方案讨论与环境准备 (进行中)**
  - [x] 确认切换底层库的稳定性。
  - [x] 确认 Flashlight 兼容性方案。

- [ ] **任务 1：代码重构 - 基础设置与引擎默认值**
  - [ ] 修改 `DEFAULT_SETTINGS` 使其默认使用 `native`。
  - [ ] 在 `Scan.tsx` 中切换导入，从 `Html5QrcodeScanner` 换成 `Html5Qrcode`。

- [ ] **任务 2：核心扫描逻辑重写**
  - [ ] 创建 `scannerRef` 维护 `Html5Qrcode` 实例。
  - [ ] 编写 `startScanner()` 函数：处理权限请求、启动摄像头、设置格式过滤。
  - [ ] 编写 `stopScanner()` 函数：安全关闭流。
  - [ ] 在 `useEffect` 中处理初次加载启动逻辑。

- [ ] **任务 3：UI 控制逻辑与状态管理**
  - [ ] 实现扫描成功后的即时停止 (`scanner.stop()`)。
  - [ ] 将“重新扫描”按钮逻辑从 `location.reload()` 修改为重新调用 `startScanner()`。
  - [ ] 清理冗余的 CSS hack（原先用于修改 `Html5QrcodeScanner` 样式的 `#reader` 相关 CSS）。

- [ ] **任务 4：闪光灯功能开发**
  - [ ] 在 `startScanner` 的成功回调中检测硬件是否支持 `torch`。
  - [ ] 增加 `torchEnabled` 状态及 UI 切换开关。
  - [ ] 实现闪光灯逻辑应用。

- [ ] **任务 5：防竞态与生命周期优化**
  - [ ] 确保 `setupFocusOnVideo` 仍然兼容新的加载方式。
  - [ ] 加强卸载清理（Cleanup）确保摄像头流在离开页面时 100% 释放。
