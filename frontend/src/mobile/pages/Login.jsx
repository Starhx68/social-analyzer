import React, { useState } from 'react';
import { Input, Button } from 'antd-mobile';
import { UserOutline, LockOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Toast } from 'antd-mobile';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show({ icon: 'fail', content: '请输入用户名和密码' });
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      Toast.show({ icon: 'success', content: '登录成功' });
      navigate('/mobile/home');
    } catch (error) {
      const errorData = error.response?.data;

      if (errorData?.error) {
        Toast.show({ icon: 'fail', content: errorData.error });
      } else {
        Toast.show({ icon: 'fail', content: '登录失败' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>国补订单系统</h1>
        <p style={{ color: '#666', marginBottom: 30 }}>请输入用户名和密码登录</p>
      </div>

      {/* 登录表单 */}
      <div style={{ background: '#fff', padding: 20, borderRadius: 8 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            <UserOutline fontSize={20} color="#999" />
            <Input
              placeholder="用户名"
              value={username}
              onChange={setUsername}
              clearable
              style={{ '--background-color': 'transparent' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            <LockOutline fontSize={20} color="#999" />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={value => setPassword(value)}
              clearable
              style={{ '--background-color': 'transparent' }}
            />
          </div>
        </div>

        <Button
          color="primary"
          size="large"
          block
          onClick={handleLogin}
          loading={loading}
        >
          登录
        </Button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a
            href="/manual/index.html"
            target="_blank"
            style={{ color: '#1677ff', fontSize: 14 }}
          >
            操作说明
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
