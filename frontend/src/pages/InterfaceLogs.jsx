import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Form, Input, Select, Button, DatePicker, Tag, message, Space, Modal, Tabs } from 'antd';
import { SearchOutlined, ReloadOutlined, ExclamationCircleOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const InterfaceLogs = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const fetchLogs = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const params = {
        page,
        limit: pageSize,
        ...values,
      };

      if (values.dateRange) {
        params.startDate = values.dateRange[0].format('YYYY-MM-DD HH:mm:ss');
        params.endDate = values.dateRange[1].format('YYYY-MM-DD HH:mm:ss');
        delete params.dateRange;
      }

      const res = await api.get('/interface-logs', { params });
      setData(res.data.logs);
      setPagination({
        current: res.data.page,
        pageSize: res.data.limit,
        total: res.data.total,
      });
    } catch (error) {
      console.error('获取日志失败:', error);
      // message.error('获取日志失败'); // Silence error for cleaner logs on mount if empty
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleTableChange = (newPagination) => {
    fetchLogs(newPagination.current, newPagination.pageSize);
  };

  const handleSearch = () => {
    fetchLogs(1, pagination.pageSize);
  };

  const handleReset = () => {
    form.resetFields();
    fetchLogs(1, pagination.pageSize);
  };

  const handleViewDetail = (record) => {
    setCurrentDetail(record);
    setDetailModalVisible(true);
  };

  const handleRetry = (record) => {
    Modal.confirm({
      title: '确认重试',
      icon: <ExclamationCircleOutlined />,
      content: `确定要重新调用 ${record.interface_type === 'update_sn' ? '更新SN' : '获取发票'} 接口吗？`,
      onOk: async () => {
        try {
          await api.post(`/interface-logs/${record.id}/retry`);
          message.success('重试指令已发送');
          fetchLogs(pagination.current, pagination.pageSize);
        } catch (error) {
          message.error('重试失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '调用时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: '接口类型',
      dataIndex: 'interface_type',
      key: 'interface_type',
      width: 150,
      render: (text) => {
        const types = {
          update_sn: <Tag color="blue">更新SN</Tag>,
          get_invoice: <Tag color="purple">获取发票</Tag>,
        };
        return types[text] || text;
      },
    },
    {
      title: '快乐购单号',
      dataIndex: 'crm_order_no',
      key: 'crm_order_no',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => {
        const statusMap = {
          success: <Tag color="success">成功</Tag>,
          failure: <Tag color="error">失败</Tag>,
          pending: <Tag color="warning">处理中</Tag>,
        };
        return statusMap[text] || text;
      },
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
    },
    {
      title: '重试次数',
      dataIndex: 'retry_count',
      key: 'retry_count',
      width: 100,
      align: 'center',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'failure' && (
            <Button 
              type="link" 
              size="small" 
              icon={<ReloadOutlined />} 
              onClick={() => handleRetry(record)}
            >
              重试
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title="接口调用日志">
      <Form
        form={form}
        layout="inline"
        onFinish={handleSearch}
        style={{ marginBottom: 24 }}
      >
        <Form.Item name="interfaceType" label="接口类型">
          <Select style={{ width: 120 }} allowClear placeholder="全部">
            <Option value="update_sn">更新SN</Option>
            <Option value="get_invoice">获取发票</Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select style={{ width: 100 }} allowClear placeholder="全部">
            <Option value="success">成功</Option>
            <Option value="failure">失败</Option>
          </Select>
        </Form.Item>
        <Form.Item name="crmOrderNo" label="快乐购单号">
          <Input placeholder="请输入单号" allowClear />
        </Form.Item>
        <Form.Item name="dateRange" label="时间范围">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={pagination}
        loading={loading}
        onChange={handleTableChange}
        scroll={{ x: 1300 }}
      />

      <Modal
        title="日志详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        <Tabs items={[
          { 
            key: '1', 
            label: '请求参数', 
            children: <pre style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word', background: '#f5f5f5', padding: 10 }}>{currentDetail.request_params}</pre> 
          },
          { 
            key: '2', 
            label: '响应数据', 
            children: <pre style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word', background: '#f5f5f5', padding: 10 }}>{currentDetail.response_data}</pre> 
          },
          { 
            key: '3', 
            label: '错误信息', 
            children: <pre style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word', background: '#f5f5f5', padding: 10 }}>{currentDetail.error_message || '无'}</pre> 
          },
        ]} />
      </Modal>
    </Card>
  );
};

export default InterfaceLogs;
