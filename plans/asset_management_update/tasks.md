# 开发任务 (Tasks)

## 任务 1: CSS & 局部排版调整
1. **底部导航拦截**: 修正 `AssetDetail.tsx` 的底部 Action Bar。如果是 `fixed` 定位，需为其父容器预留 `pb-28` 或根据导航栏高度调整 `bottom` 值，在移动端保证按钮完全可见。
2. **表单顺序微调**: 把 `AssetDetail.tsx` 中 `资产照片` 区块整体下移至“包含归属管理在内”的网格序列末尾。
3. **状态更换选项**: 修改 `AssetList.tsx` 及 `AssetDetail.tsx` 中状态的下拉选单结构，去除“正常”，增加“损坏”选项。

## 任务 2: 后端 - 解决 413 载荷过大、字段报错与增强接口能力
1. **修复 413 Payload Too Large**: 检查 `src/server/server.ts` (或入口文件) 中的 `express.json()` 和 `express.urlencoded()`，将其大小限制放大至 `{ limit: '10mb' }` 或 `'20mb'`。
2. **修复 Metadata 报错**: 修正 `GET /api/assets/metadata/options` 中的 SQL。查询 `organizations` 和 `departments` 的 `name` 字段，而不是 `assets` 表中不存在的 `org_name`。
3. **默认模型更新**: 将 `/src/server/routes/ai.ts` 中的默认模型显式设置为 `gemini-1.5-flash` 或用户环境变量指定的模型。

## 任务 3: 前端 - 扫码/OCR 主流程与容错重造
1. **统一页面与模式切换**: 在 `Scan.tsx` 页面增加双模式切换：【标准扫码（持续视频流扫描）】与【智能 OCR 识别（单拍/上传）】。
2. **高清直拍/上传**: 当处于 OCR 模式时，使用 `<input type="file" accept="image/*" capture="environment" />` 调用原相机拍照或上传图片。
3. **前端图片预压缩**: 在获取到 File 对象后读取成 Image，并利用 Canvas 进行适当的尺寸与质量压缩后转 Base64，再发送至后端给 AI 处理。
4. **修改比对容错**: 如果识别出来的结果为 `notFound`（未匹配上），在 Not Found 模态框中提供一个可编辑的 Input，让用户可以直接顺滑修改识别失误的代码并点击【重新匹配核对】。 

## 任务 4: 前端 - 智能填充与差分比对实现
1. **State 传递**: 修改 `Scan.tsx` 的跳转逻辑，将 OCR 识别出的全量数据对象作为 `state` 传递给详情页。
2. **详情页回填**: 在 `AssetDetail.tsx` 中增加对 `location.state.ocrData` 的监听，一旦检测到即更新 `formData`。
3. **Diff 样式开发**: 实现字段级比对逻辑。
   - 开发 `isFieldDifferent(name)` 函数。
   - 构建 `renderInputField` 组合组件，若字段不一致，渲染紫色高亮边框。
   - 增加 `resetField(name)` 逻辑挂载到“X”按钮上。
4. **模型名称展示**: 从 `/metadata/options` 接口获取 `currentModel` 并展示在页面 header 区域。

## 任务 5: 全链路联调与验证
1. 验证底部双按钮是否被导航栏遮挡情况不再发生。
2. 测试带错误容忍机制的扫码核查流程，验证 Input 文本框修改与重新请求是否正常。
3. 测试一张大于 5MB 的图片进行 OCR 核对上传，检验前后端链路是否会再次爆出 413，验证前端图片压缩与后端 body limit 调优成果。
