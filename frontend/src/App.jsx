import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Layout, ConfigProvider, theme, App as AntdApp } from 'antd'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import MaterialsUpload from './pages/MaterialsUpload'
import Audit from './pages/Audit'
import Reports from './pages/Reports'
import Organizations from './pages/Organizations'
import Users from './pages/Users'
import InterfaceLogs from './pages/InterfaceLogs'
import MainLayout from './components/MainLayout'
import MobileLayout from './mobile/MobileLayout'
import MobileLogin from './mobile/pages/Login'
import MobileHome from './mobile/pages/Home'
import MobileUpload from './mobile/pages/Upload'

const { Content } = Layout

const PrivateRoute = () => {
  const token = localStorage.getItem('token')
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

const MobilePrivateRoute = () => {
  const token = localStorage.getItem('token')
  return token ? <Outlet /> : <Navigate to="/mobile/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <AntdApp>
          <Layout style={{ minHeight: '100vh' }}>
            <Content>
              <Routes>
                {/* Mobile Routes */}
                <Route path="/mobile/login" element={<MobileLogin />} />
                <Route path="/mobile" element={<MobileLayout />}>
                  <Route element={<MobilePrivateRoute />}>
                    <Route index element={<Navigate to="/mobile/home" replace />} />
                    <Route path="home" element={<MobileHome />} />
                    <Route path="upload/:id" element={<MobileUpload />} />
                  </Route>
                </Route>

                {/* Desktop Routes */}
                <Route path="/login" element={<Login />} />
                
                <Route element={<PrivateRoute />}>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="orders/:id" element={<OrderDetail />} />
                    <Route path="upload" element={<MaterialsUpload />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="organizations" element={<Organizations />} />
                    <Route path="users" element={<Users />} />
                    <Route path="interface-logs" element={<InterfaceLogs />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Content>
          </Layout>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  )
}

export default App
