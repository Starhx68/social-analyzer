import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Image, Space, Button, Divider, Timeline, Spin, message, Row, Col, Modal } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import orderApi from '../services/orderApi';
import dayjs from 'dayjs';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  const fetchOrderDetail = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (error) {
      console.error('获取订单详情失败', error);
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getRequiredKeys = (plateType) => {
    const map = {
      home_appliance: ['delivery_note', 'sn_photo'],
      digital_3c: ['logistics_photo', 'sn_photo'],
      home_decoration: [],
      aging_adaptation: ['sign_receipt', 'delivery_note_signed', 'delivery_photo', 'receipt']
    };
    return map[plateType] || [];
  };

  const handleSubmitAudit = () => {
    const required = getRequiredKeys(order?.plate_type);
    const missing = required.filter(k => !order?.materials?.some(m => m.material_type === k));
    const needSn = required.includes('sn_photo');
    const snVal = order?.sn_code || order?.imei1 || order?.imei2;
    const labelMap = {
      invoice: '发票照片',
      receipt: '销售清单或购物小票照片',
      sn_photo: 'SN码水印照片',
      delivery_note: '送货单照片',
      energy_label: '能效标识水印照片',
      product_photo: '实物照片',
      activation_photo: '商品激活照片',
      product_front: '商品正面照片',
      product_side_or_sign: '商品侧面照片或签收凭证照片',
      product_back: '商品背面照片',
      logistics_photo: '签收物流照片',
      receiving_proof: '收货凭证照片',
      construction_before: '施工前照片',
      construction_after: '施工后照片',
      other_photo: '其他照片',
      sign_receipt: '签购单照片',
      delivery_note_signed: '送货单(签字)',
      delivery_photo: '送货照片(水印)'
    };

    if (missing.length || (needSn && !snVal)) {
      const items = [...missing.map(k => labelMap[k] || k)];
      if (needSn && !snVal) items.push('SN码值');
      Modal.warning({
        title: '提交审核前需完善资料',
        content: items.join('、')
      });
      return;
    }

    Modal.confirm({
      title: '确认提交审核',
      content: '提交后将进入审核流程,确认订单资料已全部上传完成?',
      okText: '确认提交',
      cancelText: '取消',
      okButtonProps: { loading: submitting },
      onOk: async () => {
        setSubmitting(true);
        try {
          await orderApi.submitAudit(id);
          message.success('提交审核成功');
          fetchOrderDetail();
        } catch (error) {
          console.error('提交审核失败:', error);
          message.error(error.response?.data?.error || '提交审核失败');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const getStatusTag = (status) => {
    const colors = {
      pending: 'default',
      uploading: 'processing',
      auditing: 'warning',
      approved: 'success',
      rejected: 'error',
      reported: 'purple',
      report_failed: 'red',
      invoice_collected: 'blue'
    };
    const texts = {
      pending: '待上传',
      uploading: '部分上传',
      auditing: '待审核',
      approved: '审核通过',
      rejected: '审核驳回',
      reported: '已上报',
      report_failed: '上报失败',
      invoice_collected: '发票已开具'
    };
    return <Tag color={colors[status]}>{texts[status] || status}</Tag>;
  };

  const renderMaterials = () => {
    if (!order?.materials?.length) return <p>暂无资料</p>;

    const grouped = {};
    order.materials.forEach(m => {
      if (!grouped[m.material_type]) grouped[m.material_type] = [];
      grouped[m.material_type].push(m);
    });

    const labels = {
      invoice: '发票照片',
      receipt: '销售清单或购物小票照片',
      sn_photo: 'SN码水印照片',
      delivery_note: '送货单照片',
      energy_label: '能效标识水印照片',
      product_photo: '实物照片',
      activation_photo: '商品激活照片',
      product_front: '商品正面照片',
      product_side_or_sign: '商品侧面照片或签收凭证照片',
      product_back: '商品背面照片',
      logistics_photo: '签收物流照片',
      receiving_proof: '收货凭证照片',
      construction_before: '施工前照片',
      construction_after: '施工后照片',
      other_photo: '其他照片',
      sign_receipt: '签购单照片',
      delivery_note_signed: '送货单(签字)',
      delivery_photo: '送货照片(水印)',
      install_photo: '安装照片', // 保留旧兼容
      human_machine_photo: '人机合影' // 保留旧兼容
    };

    return Object.entries(grouped).map(([type, list]) => (
      <div key={type} style={{ marginBottom: 16 }}>
        <h4>{labels[type] || type}</h4>
        <Image.PreviewGroup>
          <Space wrap>
            {list.map(m => (
              <Image
                key={m.id}
                width={120}
                src={m.file_url}
                style={{ borderRadius: 4, border: '1px solid #eee' }}
              />
            ))}
          </Space>
        </Image.PreviewGroup>
      </div>
    ));
  };

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 50 }} />;
  if (!order) return <p>订单不存在</p>;

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
            <span>订单详情</span>
            {getStatusTag(order.status)}
          </Space>
        }
        extra={
           <Space>
             {order.status === 'uploading' && (
               <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSubmitAudit}>
                 提交审核
               </Button>
             )}
             {['pending', 'uploading', 'rejected'].includes(order.status) && (
               <Button onClick={() => navigate(`/upload?orderId=${order.id}`)}>
                 上传资料
               </Button>
             )}
           </Space>
        }
      >
        <Descriptions title="基本信息" bordered column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="商户订单号">{order.mchnt_ord_no}</Descriptions.Item>
          <Descriptions.Item label="快乐购单号">{order.crm_order_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属门店">{order.organization_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="提交人">{order.user_real_name || order.user_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="提交时间">{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(order.updated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="板块类型">
            {{
              home_appliance: '家电',
              digital_3c: '3C数码',
              home_decoration: '家装',
              aging_adaptation: '适老化'
            }[order.plate_type] || order.plate_type}
          </Descriptions.Item>
        </Descriptions>

        <Descriptions title="商品信息" bordered column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="商品名称">{order.product_name}</Descriptions.Item>
          <Descriptions.Item label="商品品牌">{order.product_brand || '-'}</Descriptions.Item>
          <Descriptions.Item label="商品型号">{order.product_model || '-'}</Descriptions.Item>
          <Descriptions.Item label="商品品类">{order.product_category || '-'}</Descriptions.Item>
          <Descriptions.Item label="商品单价">¥{order.product_price}</Descriptions.Item>
          <Descriptions.Item label="商品数量">{order.product_quantity}</Descriptions.Item>
          <Descriptions.Item label="销售总额">¥{order.product_total_amount}</Descriptions.Item>
          <Descriptions.Item label="补贴金额" labelStyle={{ color: '#ff4d4f' }} contentStyle={{ color: '#ff4d4f', fontWeight: 'bold' }}>
            ¥{order.subsidy_amount}
          </Descriptions.Item>
          <Descriptions.Item label="SN号">{order.sn_code || order.imei1 || order.imei2 || '-'}</Descriptions.Item>
          <Descriptions.Item label="能效等级">{order.goods_energy_grade || '-'}</Descriptions.Item>
        </Descriptions>

        <Descriptions title="发票与支付" bordered column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="发票抬头">{order.invoice_title || '-'}</Descriptions.Item>
          <Descriptions.Item label="发票代码">{order.invoice_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="发票号码">{order.invoice_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="开票日期">{order.invoice_date ? dayjs(order.invoice_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
          <Descriptions.Item label="发票金额">¥{order.invoice_amount || '-'}</Descriptions.Item>
          <Descriptions.Item label="校验码">{order.invoice_check_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="发票备注" span={3}>{order.invoice_remark || '-'}</Descriptions.Item>
        </Descriptions>

        <Descriptions title="商户与物流" bordered column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="商户名称">{order.mchnt_nm || '-'}</Descriptions.Item>
          <Descriptions.Item label="商户号">{order.mchnt_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="门店地址">{order.mchnt_reg_dist || '-'}</Descriptions.Item>
          <Descriptions.Item label="配送方式">{order.delivery_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="物流单号">{order.delivery_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="签收时间">{order.signed_time ? dayjs(order.signed_time).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
          <Descriptions.Item label="收货地址" span={3}>{order.delivery_address || '-'}</Descriptions.Item>
        </Descriptions>

        <Divider />

        <h3>申请资料</h3>
        {renderMaterials()}

        {order.audit_status && (
          <>
            <Divider />
            <h3>审核信息</h3>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="审核结果">
                {order.audit_status === 'approved' ? <Tag color="success">通过</Tag> : <Tag color="error">驳回</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="审核时间">
                {order.audit_time ? dayjs(order.audit_time).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审核意见">
                {order.audit_remark || '无'}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Card>
    </div>
  );
};

export default OrderDetail;
