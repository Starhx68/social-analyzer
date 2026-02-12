import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Select, Tag, Space, Form, Modal, message, Tooltip, Popconfirm, Row, Col } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const Users = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    role: undefined,
    organizationId: undefined,
    status: undefined
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    fetchData();
    fetchOrganizations();
  }, [params]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users', { params });
      setData(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await api.get('/organizations', { params: { limit: 100 } });
      setOrganizations(res.data.organizations);
    } catch (error) {
      console.error('获取组织列表失败', error);
    }
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleResetPassword = (record) => {
    setResettingUser(record);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/users', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (values) => {
    if (!resettingUser) return;
    setSubmitting(true);
    try {
      await api.post(`/users/${resettingUser.id}/reset-password`, values);
      message.success('密码重置成功');
      setPasswordModalVisible(false);
    } catch (error) {
      message.error('操作失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: role => {
        const roles = { admin: '管理员', auditor: '审核员', user: '普通用户' };
        return <Tag color={role === 'admin' ? 'purple' : role === 'auditor' ? 'blue' : 'default'}>{roles[role] || role}</Tag>;
      }
    },
    {
      title: '所属组织',
      dataIndex: 'organization_name',
      key: 'organization_name',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
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
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => handleResetPassword(record)}>
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="用户管理" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
        新增用户
      </Button>
    }>
      <Form
        layout="inline"
        style={{ marginBottom: 24 }}
        onFinish={(values) => setParams({ ...params, page: 1, ...values })}
      >
        <Form.Item name="role">
          <Select placeholder="角色" style={{ width: 120 }} allowClear>
            <Select.Option value="admin">管理员</Select.Option>
            <Select.Option value="auditor">审核员</Select.Option>
            <Select.Option value="user">普通用户</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="organizationId">
          <Select 
            placeholder="所属组织" 
            style={{ width: 200 }} 
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {organizations.map(org => (
              <Select.Option key={org.id} value={org.id}>{org.name}</Select.Option>
            ))}
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
        scroll={{ x: 1000 }}
        pagination={{
          current: params.page,
          pageSize: params.limit,
          total: total,
          onChange: (page, limit) => setParams({ ...params, page, limit })
        }}
      />

      {/* 用户编辑 Modal */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
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
          initialValues={{ status: 'active', role: 'user' }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 3, message: '至少3个字符' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '至少6个字符' }]}>
              <Input.Password />
            </Form.Item>
          )}

          <Form.Item name="realName" label="真实姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="admin">管理员</Select.Option>
                  <Select.Option value="auditor">审核员</Select.Option>
                  <Select.Option value="user">普通用户</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="organizationId" label="所属组织" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children">
                  {organizations.map(org => (
                    <Select.Option key={org.id} value={org.id}>{org.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          {editingUser && (
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="inactive">禁用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 重置密码 Modal */}
      <Modal
        title={`重置密码 - ${resettingUser?.username}`}
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        onOk={() => passwordForm.submit()}
        confirmLoading={submitting}
        width={400}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
        >
          <Form.Item 
            name="newPassword" 
            label="新密码" 
            rules={[{ required: true, min: 6, message: '至少6个字符' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致!'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Users;
