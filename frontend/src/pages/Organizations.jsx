import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Tag, Space, Form, Modal, message } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const Organizations = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    keyword: undefined,
    type: undefined,
    status: undefined
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/organizations', { params });
      setData(response.data.organizations);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取组织列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingOrg(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      type: record.type,
      contactPerson: record.contact_person,
      contactPhone: record.contact_phone,
      address: record.district,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingOrg(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingOrg) {
        await api.put(`/organizations/${editingOrg.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/organizations', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('操作失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeBlur = async (e) => {
    const code = e.target.value;
    if (!code || editingOrg) return;

    try {
      const response = await api.get(`/organizations/lookup-vendor/${code}`);
      if (response.data.name) {
        form.setFieldsValue({ name: response.data.name });
        message.success('已自动获取组织名称');
      }
    } catch (error) {
      console.error('Vendor lookup failed:', error);
      if (error.response && error.response.status === 404) {
         message.warning('未找到对应供应商信息');
      } else if (error.response && error.response.status === 503) {
         message.warning('Oracle 服务未启用');
      }
    }
  };

  const columns = [
    {
      title: '组织名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: type => {
        const types = { retailer: '销售企业', brand: '品牌方', government: '监管部门' };
        return types[type] || type;
      }
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Card title="组织管理" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
        新增组织
      </Button>
    }>
      <Form
        layout="inline"
        style={{ marginBottom: 24 }}
        onFinish={(values) => setParams({ ...params, page: 1, ...values })}
      >
        <Form.Item name="keyword">
          <Input placeholder="名称/编码" prefix={<SearchOutlined />} />
        </Form.Item>
        <Form.Item name="type">
          <Select placeholder="类型" style={{ width: 120 }} allowClear>
            <Select.Option value="retailer">销售企业</Select.Option>
            <Select.Option value="brand">品牌方</Select.Option>
            <Select.Option value="government">监管部门</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态" style={{ width: 120 }} allowClear>
            <Select.Option value="active">启用</Select.Option>
            <Select.Option value="inactive">禁用</Select.Option>
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
        scroll={{ x: 800 }}
        pagination={{
          current: params.page,
          pageSize: params.limit,
          total: total,
          onChange: (page, limit) => setParams({ ...params, page, limit })
        }}
      />

      <Modal
        title={editingOrg ? '编辑组织' : '新增组织'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: 'active', type: 'retailer' }}
        >
          <Form.Item name="code" label="组织编码" rules={[{ required: true }]}>
            <Input disabled={!!editingOrg} onBlur={handleCodeBlur} placeholder="输入编码自动获取名称" />
          </Form.Item>
          <Form.Item name="name" label="组织名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="retailer">销售企业</Select.Option>
              <Select.Option value="brand">品牌方</Select.Option>
              <Select.Option value="government">监管部门</Select.Option>
            </Select>
          </Form.Item>
          <Space>
            <Form.Item name="contactPerson" label="联系人">
              <Input />
            </Form.Item>
            <Form.Item name="contactPhone" label="联系电话">
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          {editingOrg && (
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="inactive">禁用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default Organizations;
