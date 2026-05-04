# 资产导入与字段扩展实现任务清单

## 数据库与后端 (API)
- [ ] **任务 1：升级数据库架构**
  - [ ] 修改 `src/server/db.ts` 或对应数据库模型，为 `assets` 表添加 `location_name`, `remarks`, `model` (规格型号) 三个新字段。
  - [ ] 确保 `model` 字段在数据库中具有足够的长度上限以容纳详细规格。

- [ ] **任务 2：重写 Excel 导入路由 (`src/server/routes/excel.ts`)**
  - [ ] 更新 `import-preview` 的列映射 logic，将“规格型号”映射到 `model`。
  - [ ] 更新 `import-commit` 以持久化这些新字段。

- [ ] **任务 3：更新导出逻辑**
  - [ ] 修改 `export` 路由，将新增字段包含在导出的 JSON/Excel 中。

- [ ] **任务 4：适配 CRUD 路由 (`src/server/routes/assets.ts`)**
  - [ ] 修改 `GET /` 和 `GET /:id` 以确保新字段被返回。
  - [ ] 修改 `POST /` 和 `PATCH /:id` 以支持接收并保存新字段。

## 前端 (UI)
- [ ] **任务 5：更新前端类型声明**
  - [ ] 在 `AssetList.tsx` 和 `AssetDetail.tsx` 中同步更新 `Asset` 接口定义。

- [ ] **任务 6：重构资产详情页 (`AssetDetail.tsx`)**
  - [ ] 在编辑模式下增加新字段的输入框。
  - [ ] 在展示模式下美化新字段的呈现。

- [ ] **任务 7：优化导入预览界面 (`AssetList.tsx`)**
  - [ ] 在预览 Modal 的表格中加入“位置名称”列。
  - [ ] 确保前端提交到 `import-commit` 的数据结构完整。

- [ ] **任务 8：(可选) 列表展示增强**
  - [ ] 在列表主页的表格中根据空间情况展示“位置”属性。
