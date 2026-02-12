import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Tag, Space, DatePicker, Form, Drawer, Descriptions, Image, Divider, Radio, message } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const Audit = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    status: 'auditing', // Default to auditing
    keyword: undefined,
  });

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [auditForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [params]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders', { params });
      setData(response.data.orders);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuditClick = async (record) => {
    try {
      const res = await api.get(`/orders/${record.id}`);
      setCurrentOrder(res.data);
      setDrawerVisible(true);
      auditForm.resetFields();
    } catch (error) {
      message.error('获取订单详情失败');
    }
  };

  const handleAuditSubmit = async (values) => {
    if (!currentOrder) return;
    
    setSubmitting(true);
    try {
      await api.post(`/orders/${currentOrder.id}/audit`, {
        auditStatus: values.auditStatus,
        auditRemark: values.auditRemark
      });
      message.success('审核完成');
      setDrawerVisible(false);
      fetchOrders(); // Refresh list
    } catch (error) {
      message.error('审核失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '商户订单号',
      dataIndex: 'mchnt_ord_no',
      key: 'mchnt_ord_no',
    },
    {
      title: '快乐购单号',
      dataIndex: 'crm_order_no',
      key: 'crm_order_no',
    },
    {
      title: '所属门店',
      dataIndex: 'organization_name',
      key: 'organization_name',
    },
    {
      title: '商品',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: 'SN号',
      key: 'sn_no',
      render: (_, record) => record.sn_code || record.imei1 || record.imei2 || '-'
    },
    {
      title: '提交人',
      dataIndex: 'user_real_name',
      key: 'user_real_name',
    },
    {
      title: '商品价格',
      dataIndex: 'product_price',
      key: 'product_price',
      render: val => `¥${val}`
    },
    {
      title: '补贴金额',
      dataIndex: 'subsidy_amount',
      key: 'subsidy_amount',
      render: val => `¥${val}`
    },
    {
      title: '实付金额',
      dataIndex: 'product_total_amount',
      key: 'product_total_amount',
      render: val => `¥${val}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const colors = { auditing: 'warning', approved: 'success', rejected: 'error' };
        const texts = { auditing: '待审核', approved: '通过', rejected: '驳回' };
        return <Tag color={colors[status]}>{texts[status] || status}</Tag>;
      }
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => window.open(`/orders/${record.id}`, '_blank')}>
            详情
          </Button>
          <Button type="primary" size="small" onClick={() => handleAuditClick(record)}>
            审核
          </Button>
        </Space>
      ),
    },
  ];

  const renderMaterials = () => {
    if (!currentOrder?.materials?.length) return <p>暂无资料</p>;

    const grouped = {};
    currentOrder.materials.forEach(m => {
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

  return (
    <Card title="审核管理">
      <Form
        layout="inline"
        initialValues={{ status: 'auditing' }}
        onFinish={(values) => setParams({ ...params, page: 1, ...values })}
        style={{ marginBottom: 24 }}
      >
        <Form.Item name="keyword">
          <Input placeholder="订单号/商品" prefix={<SearchOutlined />} />
        </Form.Item>
        <Form.Item name="status">
          <Select style={{ width: 120 }}>
            <Select.Option value="auditing">待审核</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="rejected">已驳回</Select.Option>
            <Select.Option value="invoice_collected">发票已开具</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{
          current: params.page,
          pageSize: params.limit,
          total: total,
          onChange: (page, limit) => setParams({ ...params, page, limit })
        }}
      />

      <Drawer
        title="订单审核"
        width={640}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={() => auditForm.submit()} loading={submitting}>
              提交结果
            </Button>
          </Space>
        }
      >
        {currentOrder && (
          <>
            <Descriptions title="基本信息" column={2}>
              <Descriptions.Item label="商户订单号">{currentOrder.mchnt_ord_no}</Descriptions.Item>
              <Descriptions.Item label="快乐购单号">{currentOrder.crm_order_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属门店">{currentOrder.organization_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="商品名称">{currentOrder.product_name}</Descriptions.Item>
              <Descriptions.Item label="SN号">{currentOrder.sn_code || currentOrder.imei1 || currentOrder.imei2 || '-'}</Descriptions.Item>
              <Descriptions.Item label="商品品牌">{currentOrder.product_brand || '-'}</Descriptions.Item>
              <Descriptions.Item label="商品型号">{currentOrder.product_model || '-'}</Descriptions.Item>
              <Descriptions.Item label="购买人">{currentOrder.invoice_title || '-'}</Descriptions.Item>
              <Descriptions.Item label="发票代码">{currentOrder.invoice_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="发票号码">{currentOrder.invoice_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="开票日期">{currentOrder.invoice_date ? dayjs(currentOrder.invoice_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="发票金额">¥{currentOrder.invoice_amount || '-'}</Descriptions.Item>
              <Descriptions.Item label="校验码">{currentOrder.invoice_check_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="商品价格">¥{currentOrder.product_price}</Descriptions.Item>
              <Descriptions.Item label="补贴金额">¥{currentOrder.subsidy_amount}</Descriptions.Item>
              <Descriptions.Item label="实付金额">¥{currentOrder.product_total_amount}</Descriptions.Item>
              <Descriptions.Item label="提交人">{currentOrder.user_real_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核人">{currentOrder.auditor_real_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{dayjs(currentOrder.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            </Descriptions>
            
            <Divider />
            
            <h3>申请资料</h3>
            {renderMaterials()}
            
            <Divider />
            
            <h3>审核操作</h3>
            <Form
              form={auditForm}
              layout="vertical"
              onFinish={handleAuditSubmit}
              initialValues={{ auditStatus: 'approved' }}
            >
              <Form.Item name="auditStatus" label="审核结果" rules={[{ required: true }]}>
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="approved" style={{ color: '#3f8600' }}>
                    <CheckCircleOutlined /> 通过
                  </Radio.Button>
                  <Radio.Button value="rejected" style={{ color: '#cf1322' }}>
                    <CloseCircleOutlined /> 驳回
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item 
                name="auditRemark" 
                label="审核意见" 
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (getFieldValue('auditStatus') === 'rejected' && !value) {
                        return Promise.reject('驳回时必须填写审核意见');
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <TextArea rows={4} placeholder="请输入审核意见（驳回时必填）" />
              </Form.Item>
            </Form>
          </>
        )}
      </Drawer>
    </Card>
  );
};

export default Audit;
