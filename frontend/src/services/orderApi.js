/**
 * 订单API服务
 * 提供订单相关的API接口
 */
import api from './api'

/**
 * 获取订单列表
 * @param {Object} params - 查询参数
 * @returns {Promise} 订单列表
 */
export const getOrders = (params) => {
  return api.get('/orders', { params })
    .then(res => res.data)
    .catch(err => {
      console.error('获取订单列表失败:', err)
      throw err
    })
}

/**
 * 获取订单详情
 * @param {string} orderId - 订单ID
 * @returns {Promise} 订单详情
 */
export const getOrderDetail = (orderId) => {
  return api.get(`/orders/${orderId}`)
    .then(res => res.data)
    .catch(err => {
      console.error('获取订单详情失败:', err)
      throw err
    })
}

/**
 * 创建订单
 * @param {Object} data - 订单数据
 * @returns {Promise} 创建的订单
 */
export const createOrder = (data) => {
  return api.post('/orders', data)
    .then(res => res.data)
    .catch(err => {
      console.error('创建订单失败:', err)
      throw err
    })
}

/**
 * 更新订单
 * @param {string} orderId - 订单ID
 * @param {Object} data - 更新数据
 * @returns {Promise} 更新后的订单
 */
export const updateOrder = (orderId, data) => {
  return api.put(`/orders/${orderId}`, data)
    .then(res => res.data)
    .catch(err => {
      console.error('更新订单失败:', err)
      throw err
    })
}

/**
 * 部分更新订单
 * @param {string} orderId - 订单ID
 * @param {Object} data - 更新数据
 * @returns {Promise} 更新后的订单
 */
export const patchOrder = (orderId, data) => {
  return api.patch(`/orders/${orderId}`, data)
    .then(res => res.data)
    .catch(err => {
      console.error('部分更新订单失败:', err)
      throw err
    })
}

/**
 * 提交订单审核
 * @param {string} orderId - 订单ID
 * @returns {Promise} 提交结果
 */
export const submitAudit = (orderId) => {
  return api.post(`/orders/${orderId}/submit-audit`)
    .then(res => res.data)
    .catch(err => {
      console.error('提交审核失败:', err)
      throw err
    })
}

/**
 * 获取订单审核记录
 * @param {string} orderId - 订单ID
 * @returns {Promise} 审核记录列表
 */
export const getAuditLogs = (orderId) => {
  return api.get(`/orders/${orderId}/audit-logs`)
    .then(res => res.data)
    .catch(err => {
      console.error('获取审核记录失败:', err)
      throw err
    })
}

/**
 * 审核订单
 * @param {string} orderId - 订单ID
 * @param {Object} data - 审核数据 { auditStatus, auditRemark }
 * @returns {Promise} 审核结果
 */
export const auditOrder = (orderId, data) => {
  return api.post(`/orders/${orderId}/audit`, data)
    .then(res => res.data)
    .catch(err => {
      console.error('审核订单失败:', err)
      throw err
    })
}

/**
 * 订单状态枚举
 */
export const OrderStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  AUDITING: 'auditing',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

/**
 * 订单状态文本映射
 */
export const OrderStatusText = {
  [OrderStatus.PENDING]: '待上传',
  [OrderStatus.UPLOADING]: '部分上传',
  [OrderStatus.AUDITING]: '审核中',
  [OrderStatus.APPROVED]: '已通过',
  [OrderStatus.REJECTED]: '已驳回'
}

/**
 * 板块类型枚举
 */
export const PlateType = {
  HOME_APPLIANCE: 'home_appliance',
  DIGITAL_3C: 'digital_3c',
  HOME_DECORATION: 'home_decoration',
  AGING_ADAPTATION: 'aging_adaptation'
}

/**
 * 板块类型文本映射
 */
export const PlateTypeText = {
  [PlateType.HOME_APPLIANCE]: '家电',
  [PlateType.DIGITAL_3C]: '3C数码',
  [PlateType.HOME_DECORATION]: '家装',
  [PlateType.AGING_ADAPTATION]: '适老化'
}

/**
 * 同步状态枚举
 */
export const SyncStatus = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
  UPDATING: 'updating'
}

/**
 * 同步状态文本映射
 */
export const SyncStatusText = {
  [SyncStatus.PENDING]: '待处理',
  [SyncStatus.SYNCED]: '已同步',
  [SyncStatus.FAILED]: '同步失败',
  [SyncStatus.UPDATING]: '更新中'
}

/**
 * 上报状态枚举
 */
export const ReportStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed'
}

/**
 * 上报状态文本映射
 */
export const ReportStatusText = {
  [ReportStatus.PENDING]: '待上报',
  [ReportStatus.SUCCESS]: '上报成功',
  [ReportStatus.FAILED]: '上报失败'
}

/**
 * 格式化订单状态
 * @param {string} status - 状态值
 * @returns {string} 状态文本
 */
export const formatOrderStatus = (status) => {
  return OrderStatusText[status] || status
}

/**
 * 格式化板块类型
 * @param {string} type - 板块类型
 * @returns {string} 类型文本
 */
export const formatPlateType = (type) => {
  return PlateTypeText[type] || type
}

/**
 * 格式化同步状态
 * @param {string} status - 同步状态
 * @returns {string} 状态文本
 */
export const formatSyncStatus = (status) => {
  return SyncStatusText[status] || status
}

/**
 * 格式化上报状态
 * @param {string} status - 上报状态
 * @returns {string} 状态文本
 */
export const formatReportStatus = (status) => {
  return ReportStatusText[status] || status
}

/**
 * 获取订单状态颜色
 * @param {string} status - 状态值
 * @returns {string} 颜色值
 */
export const getOrderStatusColor = (status) => {
  const colorMap = {
    [OrderStatus.PENDING]: 'default',
    [OrderStatus.UPLOADING]: 'processing',
    [OrderStatus.AUDITING]: 'warning',
    [OrderStatus.APPROVED]: 'success',
    [OrderStatus.REJECTED]: 'error'
  }
  return colorMap[status] || 'default'
}

/**
 * 获取同步状态颜色
 * @param {string} status - 状态值
 * @returns {string} 颜色值
 */
export const getSyncStatusColor = (status) => {
  const colorMap = {
    [SyncStatus.PENDING]: 'default',
    [SyncStatus.SYNCED]: 'success',
    [SyncStatus.FAILED]: 'error',
    [SyncStatus.UPDATING]: 'processing'
  }
  return colorMap[status] || 'default'
}

/**
 * 获取上报状态颜色
 * @param {string} status - 状态值
 * @returns {string} 颜色值
 */
export const getReportStatusColor = (status) => {
  const colorMap = {
    [ReportStatus.PENDING]: 'default',
    [ReportStatus.SUCCESS]: 'success',
    [ReportStatus.FAILED]: 'error'
  }
  return colorMap[status] || 'default'
}

export default {
  getOrders,
  getOrderDetail,
  createOrder,
  updateOrder,
  patchOrder,
  submitAudit,
  getAuditLogs,
  auditOrder,
  OrderStatus,
  PlateType,
  SyncStatus,
  ReportStatus,
  OrderStatusText,
  PlateTypeText,
  SyncStatusText,
  ReportStatusText,
  formatOrderStatus,
  formatPlateType,
  formatSyncStatus,
  formatReportStatus,
  getOrderStatusColor,
  getSyncStatusColor,
  getReportStatusColor
}
