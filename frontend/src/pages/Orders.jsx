import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Input, Select, Tag, Space, DatePicker, Form, Modal, List, message } from 'antd';
import { SearchOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const PCMobileQueryComponent = ({ onSelect }) => {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleQuery = async () => {
    if (!mobile) return message.warning('请输入手机号');
    setLoading(true);
    try {
      const res = await api.post('/orders/query-by-mobile', { mobile });
      if (res.data.success) {
         const list = res.data.orders || [];
         setResults(list);
         if (list.length === 0) {
             message.info('未找到相关订单');
         }
      }
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.error || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAll = () => {
      const orderNos = results.map(r => r.order_no);
      onSelect(orderNos);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Input 
           placeholder="请输入手机号" 
           value={mobile} 
           onChange={e => setMobile(e.target.value)} 
           onPressEnter={handleQuery}
           style={{ flex: 1 }}
        />
        <Button type="primary" loading={loading} onClick={handleQuery}>
          查询
        </Button>
      </div>
      {results.length > 0 && (
          <div style={{ marginBottom: 16 }}>
              <Button block type="primary" ghost onClick={handleViewAll}>
                  查看全部 ({results.length})
              </Button>
          </div>
      )}
      <List
        bordered
        dataSource={results}
        renderItem={item => (
          <List.Item
            actions={[<a key="select" onClick={() => onSelect(item.order_no)}>选择</a>]}
          >
            <List.Item.Meta
              title={item.order_no}
              description={item.crm_order_no ? `CRM单号: ${item.crm_order_no}` : ''}
            />
          </List.Item>
        )}
        style={{ maxHeight: 300, overflowY: 'auto' }}
      />
    </div>
  );
};

const Orders = () => {
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [mobileQueryVisible, setMobileQueryVisible] = useState(false);
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    plateType: undefined,
    status: searchParams.get('status') || undefined,
    keyword: undefined,
    exactOrderNos: undefined,
    startDate: undefined,
    endDate: undefined
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    const status = searchParams.get('status') || undefined;
    if (status !== params.status) {
      setParams(prev => ({ ...prev, status, page: 1 }));
      form.setFieldsValue({ status });
    }
  }, [searchParams, params.status, form]);

  const fetchOrders = useCallback(async () => {
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
  }, [params]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
      title: '商品名称',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: '品牌',
      dataIndex: 'product_brand',
      key: 'product_brand',
    },
    {
      title: '型号',
      dataIndex: 'product_model',
      key: 'product_model',
    },
    // SN号字段已隐藏
    // {
    //   title: 'SN号',
    //   key: 'sn_no',
    //   render: (_, record) => record.sn_code || record.imei1 || record.imei2 || '-'
    // },
    {
      title: '板块类型',
      dataIndex: 'plate_type',
      key: 'plate_type',
      render: (type) => {
        const types = {
          home_appliance: '家电',
          digital_3c: '3C数码',
          home_decoration: '家装',
          aging_adaptation: '适老化'
        };
        return <Tag>{types[type] || type}</Tag>;
      }
    },
    {
      title: '购买人',
      dataIndex: 'invoice_title',
      key: 'invoice_title',
    },
    {
      title: '商品价格',
      dataIndex: 'product_price',
      key: 'product_price',
      render: (val) => `¥${val}`
    },
    // 补贴金额和实付金额已隐藏
    // {
    //   title: '补贴金额',
    //   dataIndex: 'subsidy_amount',
    //   key: 'subsidy_amount',
    //   render: (val) => `¥${val}`
    // },
    // {
    //   title: '实付金额',
    //   dataIndex: 'product_total_amount',
    //   key: 'product_total_amount',
    //   render: (val) => `¥${val}`
    // },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          pending: 'default',
          uploading: 'processing',
          auditing: 'warning',
          approved: 'success',
          rejected: 'error',
          reported: 'purple',
          report_failed: 'red'
        };
        const texts = {
          pending: '待上传',
          uploading: '部分上传',
          auditing: '待审核',
          approved: '审核通过',
          rejected: '审核驳回',
          reported: '已上报',
          report_failed: '上报失败'
        };
        return <Tag color={colors[status]}>{texts[status] || status}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => navigate(`/orders/${record.id}`)}
          >
            详情
          </Button>
          <Button 
            type="link" 
            icon={<UploadOutlined />}
            onClick={() => navigate(`/upload?orderId=${record.id}`)}
            disabled={['auditing', 'approved', 'reported', 'invoice_collected'].includes(record.status)}
          >
            上传资料
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="订单管理">
      <Form
        form={form}
        layout="inline"
        initialValues={{ status: params.status }}
        style={{ marginBottom: 24 }}
        onFinish={(values) => {
          setParams({
            ...params,
            page: 1,
            ...values,
            exactOrderNos: undefined,
            startDate: values.dateRange?.[0]?.toISOString(),
            endDate: values.dateRange?.[1]?.toISOString(),
            dateRange: undefined
          });
        }}
      >
        <Form.Item name="keyword">
          <Input placeholder="订单号/商品/发票号" prefix={<SearchOutlined />} />
        </Form.Item>
        <Form.Item name="plateType" style={{ width: 150 }}>
          <Select placeholder="板块类型" allowClear>
            <Select.Option value="home_appliance">家电</Select.Option>
            <Select.Option value="digital_3c">3C数码</Select.Option>
            <Select.Option value="home_decoration">家装</Select.Option>
            <Select.Option value="aging_adaptation">适老化</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" style={{ width: 150 }}>
          <Select placeholder="状态" allowClear>
            <Select.Option value="pending">待上传</Select.Option>
            <Select.Option value="auditing">待审核</Select.Option>
            <Select.Option value="approved">审核通过</Select.Option>
            <Select.Option value="rejected">审核驳回</Select.Option>
            <Select.Option value="invoice_collected">发票已开具</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="dateRange">
          <RangePicker />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
        <Form.Item>
          <Button onClick={() => navigate('/orders/create')}>新建订单</Button>
        </Form.Item>
        <Form.Item>
          <Button onClick={() => setMobileQueryVisible(true)}>手机号找单</Button>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: params.page,
          pageSize: params.limit,
          total: total,
          onChange: (page, pageSize) => setParams(prev => ({ ...prev, page, limit: pageSize })),
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      <Modal
        title="手机号找单"
        open={mobileQueryVisible}
        onCancel={() => setMobileQueryVisible(false)}
        footer={null}
      >
        <PCMobileQueryComponent onSelect={(val) => {
            setMobileQueryVisible(false);
            if (Array.isArray(val)) {
                // Multiple orders
                setParams(prev => ({ 
                    ...prev, 
                    exactOrderNos: val, 
                    keyword: undefined, 
                    page: 1 
                }));
                form.setFieldsValue({ keyword: `手机号关联 ${val.length} 单` });
            } else {
                form.setFieldsValue({ keyword: val });
                setParams(prev => ({ ...prev, keyword: val, exactOrderNos: undefined, page: 1 }));
            }
        }} />
      </Modal>
    </Card>
  );
};

export default Orders;
