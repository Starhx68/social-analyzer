import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Dropdown, Space } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  ShoppingOutlined,
  CloudUploadOutlined,
  AuditOutlined,
  BarChartOutlined,
  TeamOutlined,
  UserOutlined,
  ApiOutlined,
  LogoutOutlined,
  BankOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: '个人信息',
        icon: <UserOutlined />,
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        onClick: handleLogout,
      },
    ],
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/orders',
      icon: <ShoppingOutlined />,
      label: '订单管理',
    },
    {
      key: '/audit',
      icon: <AuditOutlined />,
      label: '审核管理',
      hidden: user.role === 'user',
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '数据上报',
      hidden: user.role === 'user',
    },
    {
      key: '/organizations',
      icon: <BankOutlined />,
      label: '组织管理',
      hidden: user.role !== 'admin',
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: '用户管理',
      hidden: user.role === 'user',
    },
    {
      key: '/interface-logs',
      icon: <ApiOutlined />,
      label: '接口日志',
      hidden: user.role !== 'admin' && user?.username !== 'demo001',
    },
  ].filter(item => !item.hidden);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
        onCollapse={(collapsed, type) => {
          if (type === 'responsive') setCollapsed(collapsed);
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}>
          {collapsed ? '国补' : '国补订单系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/dashboard']}
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            // 移动端点击菜单后自动收起
            if (window.innerWidth < 992) {
              setCollapsed(true);
            }
          }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          
          <Space>
            <span>{user.organizationName} - {user.realName}</span>
            <Dropdown menu={userMenu}>
              <Button type="text" icon={<UserOutlined />} />
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto'
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
