# 开发任务清单 (Tasks)

- [ ] **任务 1：界面深度汉化**
  - [ ] 修改 `Scan.tsx`，通过 `html5-qrcode` 渲染配置及 DOM 手动注入实现按钮和提示语汉化。
  - [ ] 全量核查前端组件中的遗留英文文案（AssetList, AssetDetail, Login）。

- [ ] **任务 2：后端人员管理 API 开发**
  - [ ] 修改 `users` 表结构：添加 `departments` 字段（TEXT，存储为逗号分隔的字符串或 JSON）。
  - [ ] 扩展 `/api/users` 路由：
    - [ ] `GET /`：获取用户列表（含管辖部门列表）。
    - [ ] `POST /`：新增用户（包含多部门 `departments` 录入）。
    - [ ] `PUT /:id`：更新用户（包含多部门 `departments` 修改）。
    - [ ] `POST /:id/reset-password`：重置用户密码。
    - [ ] `DELETE /:id`：删除用户。
  - [ ] 确保 API 受到 `requireAdmin` 中间件保护。

- [ ] **任务 3：前端人员管理界面实现**
  - [ ] 创建 `PeopleManagement.tsx` 页面。
  - [ ] 实现用户列表，并在编辑弹窗中使用**多选下拉框 (Multi-select)** 允许选择多个部门。
  - [ ] 在 `AppLayout.tsx` 和 `App.tsx` 中配置相关路由。

- [ ] **任务 4：数据与图片打包导出控制**
  - [ ] 安装 `archiver` 依赖。
  - [ ] 在 `routes/excel.ts` 增加导出权限校验（Ensure `requireAdmin` for export）。
  - [ ] 实现图片打包流水线。
  - [ ] 前端 `AssetList.tsx` 动态渲染导出按钮（仅对管理员可见）。

- [ ] **任务 5：资产编辑权限深度开发**
  - [ ] 后端逻辑：在 `PUT /api/assets/:id` 中增加权限校验（如果是操作员，检查资产当前部门是否在其 `departments` 列表中）。
  - [ ] 前端 `AssetDetail.tsx`：
    - [ ] 获取当前登录用户的管辖部门列表。
    - [ ] 当 `user.role === 'operator'` 且 `!user.departments.includes(asset.dept_name)` 时，禁用所有输入框和保存按钮。
    - [ ] 增加权限提示信息（如：“您无权编辑非管辖范围内的资产”）。
  - [ ] 完善审计日志，确保部门异动也记录在案。
