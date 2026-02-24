import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TabBar } from 'antd-mobile';
import { AppOutline } from 'antd-mobile-icons';

const MobileLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;

  // Only show TabBar on main pages (like home)
  // Hide on sub-pages like upload details
  const showTabBar = pathname === '/mobile/home';

  const tabs = [
    {
      key: '/mobile/home',
      title: '首页',
      icon: <AppOutline />,
    },
    // Add more tabs if needed, e.g. Profile
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
      
      {showTabBar && (
        <div style={{ borderTop: '1px solid #eee', background: '#fff' }}>
          <TabBar activeKey={pathname} onChange={value => navigate(value)}>
            {tabs.map(item => (
              <TabBar.Item key={item.key} icon={item.icon} title={item.title} />
            ))}
          </TabBar>
        </div>
      )}
    </div>
  );
};

export default MobileLayout;
