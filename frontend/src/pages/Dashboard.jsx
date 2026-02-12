import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import { 
  ShoppingOutlined, 
  AuditOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  CloudUploadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    auditing: 0,
    approved: 0,
    rejected: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, statsRes] = await Promise.all([
          api.get('/orders', { params: { page: 1, limit: 5 } }),
          api.get('/orders/stats')
        ]);
        
        setRecentOrders(ordersRes.data.orders);
        setStats(statsRes.data);
      } catch (error) {
        console.error('获取仪表盘数据失败', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'mchnt_ord_no',
      key: 'mchnt_ord_no',
    },
    {
      title: '快乐购单号',
      dataIndex: 'crm_order_no',
      key: 'crm_order_no',
    },
    {
      title: '商品',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: '实付金额',
      dataIndex: 'product_total_amount',
      key: 'product_total_amount',
      render: val => `¥${val}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const colors = {
          pending: 'default',
          auditing: 'warning',
          approved: 'success',
          rejected: 'error',
          invoice_collected: 'blue'
        };
        const texts = {
          pending: '待上传',
          auditing: '待审核',
          approved: '审核通过',
          rejected: '审核驳回',
          invoice_collected: '发票已开具'
        };
        return <Tag color={colors[status]}>{texts[status] || status}</Tag>;
      }
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable 
            onClick={() => navigate('/orders')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="总订单"
              value={stats.total}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable 
            onClick={() => navigate('/orders?status=auditing')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="待审核"
              value={stats.auditing}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable 
            onClick={() => navigate('/orders?status=approved')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="审核通过"
              value={stats.approved}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable 
            onClick={() => navigate('/orders?status=rejected')}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title="审核驳回"
              value={stats.rejected}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近订单">
        <Table
          columns={columns}
          dataSource={recentOrders}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>

      <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 8 }}>
        <a href="/manual/index.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>
          查看操作说明
        </a>
      </div>
    </div>
  );
};

export default Dashboard;
