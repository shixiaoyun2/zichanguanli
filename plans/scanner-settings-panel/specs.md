# 扫码器功能重构与增强规范 (Specs)

## 1. 核心架构调整
- **弃用 `Html5QrcodeScanner`，改用 `Html5Qrcode` 底层库**：
  - 手动管理渲染容器，避免自动生成可能引起刷新的按钮。
  - 完全控制摄像头的启动 (`start`) 和停止 (`stop`)。

## 2. 问题修复方案
- **重复 UI 修复**：
  - 在 `useEffect` 的启动逻辑前，显式检查并清空容器内容。
  - 使用 `scannerRef` 严格保留唯一实例，销毁时确保执行 `stop()`。
- **扫描成功逻辑优化**：
  - 一旦识别成功，立即调用 `scanner.stop()` 物理关闭摄像头。
  - UI 切换到“结果确认”模式。
- **刷新问题根治**：
  - 自定义所有控制按钮，确保 `type="button"`，杜绝默认行为。

## 3. 功能增强
- **闪光灯 (Torch) 支持**：
  - 获取视频轨道的能力集 (`getCapabilities`)。
  - 检查 `torch` 是否可用。
  - 通过 `track.applyConstraints({ advanced: [{ torch: state }] })` 控制开关。
- **引擎默认值**：
  - 将 `settings.engine` 的默认值从 `default` 改为 `native` (使用 BarcodeDetector)。
- **重新扫描流程**：
  - 点击“重新扫描”时，清空当前结果状态，调用 `startScanner()` 函数重新激活摄像头流，而非刷新页面。

## 4. UI 刷新
- 在预览区浮现一个“闪光灯”图标按钮（仅在摄像头运行时显示且设备支持时可见）。
- 确保扫码预览区在不同屏幕尺寸下的纵横比一致。
