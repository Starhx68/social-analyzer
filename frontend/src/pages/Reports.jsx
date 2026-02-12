import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, Space, message, Tabs, Form, Input, Select } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    status: undefined,
    reportType: undefined,
    orderId: undefined
  });

  useEffect(() => {
    fetchLogs();
  }, [params]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/logs', { params });
      setData(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取上报日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (record) => {
    try {
      await api.post(`/reports/retry/${record.id}`);
      message.success('重试指令已发送');
      fetchLogs();
    } catch (error) {
      message.error('重试失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const columns = [
    {
      title: '商户订单号',
      dataIndex: 'mchnt_ord_no',
      key: 'mchnt_ord_no',
    },
    {
      title: '上报类型',
      dataIndex: 'report_type',
      key: 'report_type',
      render: type => {
        const types = { audit_system: '审核系统', central_platform: '中央平台' };
        return types[type] || type;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const colors = { pending: 'default', processing: 'processing', success: 'success', failed: 'error', retrying: 'warning' };
        return <Tag color={colors[status]}>{status}</Tag>;
      }
    },
    {
      title: '重试次数',
      dataIndex: 'retry_count',
      key: 'retry_count',
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
    },
    {
      title: '上报时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        record.status === 'failed' && (
          <Button 
            type="link" 
            icon={<ReloadOutlined />} 
            onClick={() => handleRetry(record)}
            disabled={record.retry_count >= record.max_retries}
          >
            重试
          </Button>
        )
      ),
    },
  ];

  return (
    <Card title="数据上报日志">
      <Form
        layout="inline"
        style={{ marginBottom: 24 }}
        onFinish={(values) => setParams({ ...params, page: 1, ...values })}
      >
        <Form.Item name="orderId">
          <Input placeholder="订单ID" prefix={<SearchOutlined />} />
        </Form.Item>
        <Form.Item name="reportType">
          <Select placeholder="上报类型" style={{ width: 120 }} allowClear>
            <Select.Option value="audit_system">审核系统</Select.Option>
            <Select.Option value="central_platform">中央平台</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态" style={{ width: 120 }} allowClear>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
            <Select.Option value="pending">待处理</Select.Option>
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
    </Card>
  );
};

export default Reports;
