# 开发记录 - order_sync表驱动方案实施

## 概述

**开发日期**：2025-01-26
**开发人员**：Claude Code
**需求来源**：基于用户确认的双层表结构方案，实现order_sync表作为系统数据驱动表

## 一、需求背景

### 1.1 问题陈述

系统订单数据来自第三方Oracle数据库，需要：
- 将Oracle订单数据同步到本地数据库
- 实现订单的资料上传、审核功能
- 将订单数据上报到国补审核系统和中央平台

### 1.2 设计决策

采用**双层表结构**：
- **od_order_subsidy_sync**：存储Oracle原始JSON数据
- **order_sync**：业务驱动表，解析后的结构化数据
- **orders**：业务订单表，用于资料上传、审核等操作

**数据流向**：`Oracle → od_order_subsidy_sync → order_sync → orders`

## 二、实施内容

### 2.1 数据库迁移文件

#### 文件1：009_create_order_sync_table.sql
**位置**：`backend/database/migrations/009_create_order_sync_table.sql`
**功能**：创建order_sync业务驱动表

**核心字段**：
- `oracle_rowid`：关联Oracle原始数据
- `mchnt_ord_no`：商户订单号（业务主键）
- `sync_status`：同步状态（pending/synced/failed/updating）
- `report_national_status`：国补审核系统上报状态
- `report_central_status`：中央平台上报状态
- `order_id`：关联orders表

**索引**：
- idx_order_sync_mchnt_ord_no
- idx_order_sync_sync_status
- idx_order_sync_order_id
- idx_order_sync_external_updated

#### 文件2：010_add_sync_id_to_orders.sql
**位置**：`backend/database/migrations/010_add_sync_id_to_orders.sql`
**功能**：为orders表添加sync_id关联

**核心变更**：
- 添加`sync_id`字段关联到order_sync表
- 添加唯一约束确保一对一关系
- 创建触发器自动同步两表数据
- 添加上报时间戳字段

**触发器**：
- `trigger_sync_order`：orders表创建/更新时自动更新order_sync.order_id
- `trigger_clear_order_on_delete`：orders表删除时清空order_sync.order_id

#### 文件3：011_add_order_sync_rls.sql
**位置**：`backend/database/migrations/011_add_order_sync_rls.sql`
**功能**：添加RLS策略和辅助函数

**核心功能**：
- RLS策略：用户只能查看本单位数据
- 视图：v_order_sync_status（订单同步状态视图）
- 函数：get_orders_for_national_report（获取待上报到国补系统的订单）
- 函数：get_orders_for_central_report（获取待上报到中央平台的订单）
- 函数：update_order_report_status（更新订单上报状态）

### 2.2 后端服务实现

#### 服务1：OrderSyncService
**位置**：`backend/src/services/orderSyncService.js`
**功能**：从od_order_subsidy_sync同步数据到order_sync和orders表

**核心方法**：
- `parseOracleData(data)`：解析Oracle数据
- `syncRecord(rawSyncRecord)`：同步单条记录到order_sync表
- `createBusinessOrder(syncRecord)`：创建业务订单
- `runSync()`：批量同步
- `start(intervalSeconds)`：启动定时同步任务

**同步流程**：
1. 从od_order_subsidy_sync读取原始数据
2. 解析JSONB字段，提取业务字段
3. 写入order_sync表（新增或更新）
4. 自动创建orders表记录
5. 更新sync_status为'synced'

**触发方式**：定时任务（默认60秒）

#### 服务2：NationalAuditReportService
**位置**：`backend/src/services/reports/nationalAuditReportService.js`
**功能**：上报订单数据到国补审核系统

**核心方法**：
- `getOrdersToReport()`：获取待上报订单
- `buildReportData(order)`：组装上报数据
- `reportOrder(order)`：上报单个订单
- `runReport()`：批量上报
- `start()`：启动定时上报任务

**上报方式**：HTTP POST API
**上报范围**：report_national_status IN ('pending', 'failed')
**触发方式**：定时任务（默认300秒/5分钟）

**环境变量**：
- NATIONAL_AUDIT_REPORT_ENABLED：是否启用上报
- NATIONAL_AUDIT_API_URL：上报API地址
- NATIONAL_AUDIT_API_KEY：API密钥
- NATIONAL_AUDIT_REPORT_INTERVAL：上报间隔（秒）

#### 服务3：CentralPlatformReportService
**位置**：`backend/src/services/reports/centralPlatformReportService.js`
**功能**：生成Excel文件并通过SFTP上传到中央平台

**核心方法**：
- `getOrdersToReport()`：获取待上报订单
- `generateExcel(orders)`：生成Excel文件
- `uploadViaSFTP(localFilePath, remoteFileName)`：SFTP上传
- `runReport()`：执行上报
- `start()`：启动定时上报任务

**上报方式**：Excel文件 + SFTP上传
**上报范围**：新增或更新的订单
**触发方式**：定时任务（默认每日02:00执行）

**依赖库**：
- exceljs：生成Excel文件
- ssh2-sftp-client：SFTP客户端

**环境变量**：
- CENTRAL_PLATFORM_REPORT_ENABLED：是否启用上报
- CENTRAL_PLATFORM_SFTP_HOST：SFTP主机
- CENTRAL_PLATFORM_SFTP_PORT：SFTP端口（默认22）
- CENTRAL_PLATFORM_SFTP_USERNAME：SFTP用户名
- CENTRAL_PLATFORM_SFTP_PASSWORD：SFTP密码
- CENTRAL_PLATFORM_REMOTE_PATH：远程路径
- CENTRAL_PLATFORM_REPORT_TIME：上报时间（默认02:00）

### 2.3 API路由更新

#### 文件：backend/src/routes/orders.js
**变更内容**：

**1. 订单列表接口 (GET /api/orders)**
- 新增查询参数：
  - `syncStatus`：同步状态筛选
  - `reportNationalStatus`：国补上报状态筛选
  - `reportCentralStatus`：中央平台上报状态筛选
- 修改查询逻辑：
  - 从 `orders` 改为 `orders INNER JOIN order_sync`
  - 只显示sync_status='synced'的订单
  - 添加权限控制：普通用户只能查看本单位数据

**2. 订单详情接口 (GET /api/orders/:id)**
- 新增返回字段：
  - sync_id、oracle_rowid、external_order_id
  - sync_status、sync_error、sync_retry_count
  - report_national_status、report_central_status
  - external_created_at、external_updated_at、synced_at
  - imei1、imei2、goods_energy等特殊字段
- 新增审核日志查询

### 2.4 前端API服务

#### 文件：frontend/src/services/orderApi.js
**功能**：提供订单相关的API接口和工具函数

**核心方法**：
- `getOrders(params)`：获取订单列表
- `getOrderDetail(orderId)`：获取订单详情
- `createOrder(data)`：创建订单
- `updateOrder(orderId, data)`：更新订单
- `auditOrder(orderId, data)`：审核订单

**常量定义**：
- OrderStatus：订单状态枚举
- PlateType：板块类型枚举
- SyncStatus：同步状态枚举
- ReportStatus：上报状态枚举

**工具函数**：
- `formatOrderStatus(status)`：格式化订单状态
- `formatPlateType(type)`：格式化板块类型
- `formatSyncStatus(status)`：格式化同步状态
- `formatReportStatus(status)`：格式化上报状态
- `getOrderStatusColor(status)`：获取订单状态颜色
- `getSyncStatusColor(status)`：获取同步状态颜色
- `getReportStatusColor(status)`：获取上报状态颜色

### 2.5 后端启动服务更新

#### 文件：backend/src/index.js
**变更内容**：

**新增导入**：
```javascript
const orderSyncService = require('./services/orderSyncService');
const nationalAuditReportService = require('./services/reports/nationalAuditReportService');
const centralPlatformReportService = require('./services/reports/centralPlatformReportService');
```

**启动顺序**：
1. 初始化MinIO
2. 启动Oracle同步服务（从Oracle同步到od_order_subsidy_sync表）
3. 启动订单同步服务（从od_order_subsidy_sync同步到order_sync和orders表）
4. 启动国补审核系统上报服务
5. 启动中央平台上报服务

### 2.6 技术架构文档更新

#### 文件：technical_architecture.md
**新增章节**：

**第4章：数据同步流程**
- 4.1 数据流向（Mermaid流程图）
- 4.2 三层表结构说明
- 4.3 同步服务说明
- 4.4 状态流转说明

**数据模型章节新增**：
- order_sync表定义
- od_order_subsidy_sync表定义
- orders表新增sync_id字段说明

## 三、测试建议

### 3.1 数据库迁移测试

```bash
# 执行迁移
cd backend
npm run migrate

# 验证表结构
psql -U postgres -d guobu -c "\d order_sync"
psql -U postgres -d guobu -c "\d orders"

# 验证触发器
psql -U postgres -d guobu -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'orders'::regclass"
```

### 3.2 同步服务测试

```bash
# 启动后端服务
cd backend
npm start

# 查看日志
tail -f logs/app.log

# 验证数据同步
# 1. 确保Oracle有数据
# 2. 等待5分钟，Oracle同步到od_order_subsidy_sync
# 3. 等待1分钟，解析到order_sync
# 4. 等待orders表自动创建
```

### 3.3 API测试

```bash
# 获取订单列表（包含同步状态）
curl -X GET "http://localhost:3000/api/orders?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 获取订单详情（包含完整同步信息）
curl -X GET "http://localhost:3000/api/orders/ORDER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.4 上报服务测试

**国补审核系统上报**：
```bash
# 配置环境变量
export NATIONAL_AUDIT_REPORT_ENABLED=true
export NATIONAL_AUDIT_API_URL=https://audit.example.com/api
export NATIONAL_AUDIT_API_KEY=your_api_key

# 重启服务
npm start

# 查看上报日志
tail -f logs/app.log | grep "NationalAuditReportService"
```

**中央平台上报**：
```bash
# 配置环境变量
export CENTRAL_PLATFORM_REPORT_ENABLED=true
export CENTRAL_PLATFORM_SFTP_HOST=sftp.example.com
export CENTRAL_PLATFORM_SFTP_USERNAME=your_username
export CENTRAL_PLATFORM_SFTP_PASSWORD=your_password

# 重启服务
npm start

# 手动触发上报（测试用）
# 需要添加测试接口或修改定时任务
```

## 四、部署步骤

### 4.1 数据库迁移

```bash
# 备份数据库
pg_dump -U postgres guobu > backup_$(date +%Y%m%d).sql

# 执行迁移
cd backend/database/migrations
psql -U postgres -d guobu -f 009_create_order_sync_table.sql
psql -U postgres -d guobu -f 010_add_sync_id_to_orders.sql
psql -U postgres -d guobu -f 011_add_order_sync_rls.sql
```

### 4.2 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 新增依赖
npm install exceljs ssh2-sftp-client
```

### 4.3 配置环境变量

**backend/.env**：
```env
# 订单同步服务
ORDER_SYNC_INTERVAL=60

# 国补审核系统上报
NATIONAL_AUDIT_REPORT_ENABLED=false
NATIONAL_AUDIT_API_URL=
NATIONAL_AUDIT_API_KEY=
NATIONAL_AUDIT_REPORT_INTERVAL=300

# 中央平台上报
CENTRAL_PLATFORM_REPORT_ENABLED=false
CENTRAL_PLATFORM_SFTP_HOST=
CENTRAL_PLATFORM_SFTP_PORT=22
CENTRAL_PLATFORM_SFTP_USERNAME=
CENTRAL_PLATFORM_SFTP_PASSWORD=
CENTRAL_PLATFORM_REMOTE_PATH=/upload
CENTRAL_PLATFORM_REPORT_TIME=02:00
```

### 4.4 启动服务

```bash
# 开发环境
cd backend
npm start

# 生产环境（Docker）
docker-compose up -d backend
```

### 4.5 验证部署

```bash
# 检查进程
ps aux | grep node

# 检查日志
docker-compose logs -f backend

# 检查数据库
psql -U postgres -d guobu -c "SELECT COUNT(*) FROM order_sync"
psql -U postgres -d guobu -c "SELECT sync_status, COUNT(*) FROM order_sync GROUP BY sync_status"
```

## 五、注意事项

### 5.1 数据一致性

- **触发器保障**：orders表的创建/更新/删除会自动同步到order_sync表
- **事务管理**：OrderSyncService使用事务确保数据原子性
- **唯一约束**：mchnt_ord_no有唯一约束，防止重复订单

### 5.2 性能优化

- **索引优化**：为常用查询字段添加索引
- **批量处理**：OrderSyncService每次处理1000条记录
- **增量同步**：只同步modify_date更新的数据

### 5.3 错误处理

- **重试机制**：同步失败会记录sync_error和sync_retry_count
- **日志记录**：所有操作都记录详细日志
- **事务回滚**：错误时自动回滚事务

### 5.4 安全性

- **RLS策略**：用户只能查看本单位数据
- **API认证**：所有API接口需要JWT Token
- **数据隔离**：order_id和organization_id关联

## 六、后续优化建议

### 6.1 功能增强

1. **监控面板**：添加同步状态监控面板
2. **告警机制**：同步失败时发送告警通知
3. **手动触发**：提供手动触发同步和上报的接口
4. **批量操作**：支持批量重新同步和上报

### 6.2 性能优化

1. **并行处理**：OrderSyncService使用Worker Threads并行处理
2. **缓存机制**：Redis缓存热点数据
3. **分页优化**：大结果集分页查询优化

### 6.3 数据质量

1. **数据校验**：添加数据完整性校验
2. **去重机制**：优化去重逻辑
3. **数据修复**：提供数据修复工具

## 七、文件清单

### 7.1 数据库迁移文件
- `backend/database/migrations/009_create_order_sync_table.sql`
- `backend/database/migrations/010_add_sync_id_to_orders.sql`
- `backend/database/migrations/011_add_order_sync_rls.sql`

### 7.2 后端服务文件
- `backend/src/services/orderSyncService.js`
- `backend/src/services/reports/nationalAuditReportService.js`
- `backend/src/services/reports/centralPlatformReportService.js`
- `backend/src/routes/orders.js`（修改）
- `backend/src/index.js`（修改）

### 7.3 前端文件
- `frontend/src/services/orderApi.js`

### 7.4 文档文件
- `technical_architecture.md`（修改）
- `docs/development-log-sync-table-implementation.md`（本文档）

## 八、总结

本次开发实现了基于order_sync表的双层驱动方案，核心成果：

1. ✅ 创建了order_sync业务驱动表
2. ✅ 实现了从Oracle到order_sync到orders的完整数据流
3. ✅ 实现了国补审核系统和中央平台的上报服务
4. ✅ 更新了订单API，支持同步状态和上报状态查询
5. ✅ 提供了完整的前端API服务层
6. ✅ 更新了技术架构文档

**架构优势**：
- 数据溯源清晰（保留Oracle原始数据）
- 职责分离（原始数据/业务驱动/业务操作）
- 查询性能好（order_sync有业务索引）
- 扩展性强（支持未来对接多个第三方系统）

**下一步工作**：
- 测试数据同步流程
- 测试上报功能
- 配置生产环境
- 监控运行状态
