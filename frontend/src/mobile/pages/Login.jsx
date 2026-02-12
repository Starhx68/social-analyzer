import React, { useState } from 'react';
import { Form, Input, Button, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', values);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      Toast.show({
        icon: 'success',
        content: '登录成功',
      });
      navigate('/mobile/home');
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: error.response?.data?.error || '登录失败',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      background: '#ffffff', 
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>国补订单系统</h1>
        <p style={{ color: '#666' }}>移动端资料上传</p>
      </div>
      
      <Form
        layout='horizontal'
        footer={
          <Button block type='submit' color='primary' size='large' loading={loading}>
            登录
          </Button>
        }
        onFinish={onFinish}
      >
        <Form.Item
          name='username'
          label='用户名'
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder='请输入用户名' />
        </Form.Item>
        <Form.Item
          name='password'
          label='密码'
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input placeholder='请输入密码' type='password' />
        </Form.Item>
      </Form>
    </div>
  );
};

export default Login;
