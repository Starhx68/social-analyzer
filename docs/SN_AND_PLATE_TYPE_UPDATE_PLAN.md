# 板块类型映射与 SN 查询限制修改方案

## 1. 需求分析
1.  **板块类型映射规则变更**：
    *   数据源：从 Oracle 同步数据的 `GOODS_ATTRIBUTE` 中提取 `plbm` (品类编码)。
    *   映射规则：
        *   **家电 (`home_appliance`)**: `plbm` 为 `A01`, `A02`, `A03`, `A04`, `A05`, `A06`。
        *   **3C数码 (`digital_3c`)**: `plbm` 为 `B01`, `B02`, `B03`。
        *   其他/暂无：家装和适老化暂无对应 `plbm`，保留原有逻辑或暂不处理。
2.  **SN 查询限制放宽**：
    *   原限制：仅限 3C 数码类产品。
    *   新限制：允许 3C 数码类 **或** 品类编码为 `A05` 的产品进行 SN 查询/锁定。

## 2. 修改方案

### 2.1 后端服务 (`OrderSyncService.js`)
*   **新增方法 `getPlbmFromAttr(data)`**:
    *   解析 `GOODS_ATTRIBUTE` JSON 字符串，提取 `plbm` 字段。
*   **修改 `parseOracleData`**:
    *   优先使用 `plbm` 更新 `product_category_code` 字段（目前该字段取自 `CATEGORY_CODE`，将改为 `plbm` 优先）。
    *   **重构 `plate_type` 赋值逻辑**:
        1.  获取 `plbm`。
        2.  若 `plbm` 在 `['A01'...'A06']` -> 赋值 `home_appliance`。
        3.  若 `plbm` 在 `['B01'...'B03']` -> 赋值 `digital_3c`。
        4.  若未命中上述规则，回退到原有的 `GOODS_ATTRIBUTE.xm` 或 `PLATE_TYPE` 映射逻辑（以兼容旧数据或无 `plbm` 的情况）。

### 2.2 SN 接口路由 (`routes/sn.js`)
*   **修改查询逻辑**:
    *   原逻辑仅查询 `orders` 表。
    *   新逻辑需关联 `order_sync` 表以获取 `product_category_code` (即 `plbm`)，因为 `orders` 表可能未直接存储该字段。
    *   SQL 调整: `SELECT o.plate_type, os.product_category_code FROM orders o LEFT JOIN order_sync os ON o.sync_id = os.id ...`
*   **修改权限校验**:
    *   原条件: `plate_type === 'digital_3c'` (或 '3C数码')。
    *   新条件: `plate_type === 'digital_3c'` **OR** `product_category_code === 'A05'`。

### 2.3 数据库兼容性
*   无需修改数据库 Schema。
*   利用 `order_sync` 表已有的 `product_category_code` 字段存储 `plbm`。

## 3. 验证计划
1.  **单元测试**: 编写脚本模拟含有不同 `plbm` 的 Oracle 数据，验证 `OrderSyncService` 解析出的 `plate_type` 是否正确。
2.  **接口测试**:
    *   构造一个 `A05` 类型的订单。
    *   调用 SN 查询接口，验证是否允许通过。
    *   构造一个 `A01` 类型的订单，验证是否被拒绝。

## 4. 风险评估
*   **历史数据**: 修改映射规则仅影响新同步或更新的订单。存量订单如果未触发更新，其 `plate_type` 保持不变。若需刷新历史数据，需运行全量同步脚本。
*   **代码健壮性**: `sn.js` 中原有的中文 `'3C数码'` 判断可能存在隐患，将统一修正为数据库真实值 `digital_3c`。

请确认以上方案是否执行。
