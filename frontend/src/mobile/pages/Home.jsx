import React, { useState, useRef } from 'react';
import { SearchBar, Card, Tag, Button, Toast, ErrorBlock, CapsuleTabs, Modal, Input, List } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../../services/orderApi';
import api from '../../services/api';
import { RightOutline, ScanCodeOutline } from 'antd-mobile-icons';

const Home = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const doSearch = async (val) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await getOrders({ keyword: val, page: 1, pageSize: 10 });
      setOrders(res.orders || []);
      if (res.orders?.length === 0) {
        Toast.show('未找到相关订单');
      }
    } catch (error) {
      Toast.show({
        icon: 'fail',
        content: '查询失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async (val) => {
    if (!val) {
        doSearch(val);
        return;
    }

    // Check if mobile number (11 digits)
    if (/^1\d{10}$/.test(val)) {
        Toast.show({
            icon: 'loading',
            content: '正在查询关联订单...',
            duration: 0,
        });
        try {
            const res = await api.post('/orders/query-by-mobile', { mobile: val });
            Toast.clear();
            
            if (res.data.success && res.data.orders && res.data.orders.length > 0) {
                const orderNos = res.data.orders.map(o => o.order_no);
                
                // Call getOrders directly with exactOrderNos
                setLoading(true);
                setHasSearched(true);
                try {
                    const searchRes = await getOrders({ 
                        exactOrderNos: orderNos, 
                        page: 1, 
                        pageSize: 10 
                    });
                    setOrders(searchRes.orders || []);
                    if (searchRes.orders?.length === 0) {
                        Toast.show('未找到相关订单详情');
                    } else {
                        Toast.show({ content: `已找到 ${searchRes.orders.length} 个订单`, position: 'top' });
                    }
                } catch (err) {
                     Toast.show({ icon: 'fail', content: '查询详情失败' });
                } finally {
                    setLoading(false);
                }
                return;
            } 
            // If no external orders found, fall through to normal search
        } catch (e) {
            Toast.clear();
            console.error(e);
            // Fall through to normal search
        }
    } 
    
    // Normal search (fallback)
    doSearch(val);
  };

  const handleTabChange = (key) => {
    const val = key === 'all' ? '' : key;
    setSearchValue(val);
    onSearch(val);
  };

  const handleScanClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    Toast.show({ icon: 'loading', content: '识别订单号中...', duration: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Send file to backend using FormData
      const res = await api.post('/ocr/order-no', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Toast.clear();
      
      if (res.data.success && res.data.results && res.data.results.length > 0) {
        const orderNo = res.data.results[0].text;
        if (orderNo) {
          setSearchValue(orderNo);
          Toast.show({ icon: 'success', content: '识别成功' });
          onSearch(orderNo);
        } else {
          Toast.show('未识别到订单号');
        }
      } else {
        Toast.show('识别失败');
      }
    } catch (error) {
      Toast.clear();
      console.error('OCR error', error);
      
      let errorMessage = '识别服务异常';
      if (error.response?.status === 413) {
        errorMessage = '图片过大，请使用更低分辨率拍照';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Toast.show({ icon: 'fail', content: errorMessage });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'default';
      case 'rejected': return 'danger';
      case 'uploading': return 'primary';
      default: return 'default';
    }
  };
  
  const getStatusText = (status) => {
    const map = {
      'pending': '待上传',
      'uploading': '上传中',
      'audit_pending': '待审核',
      'audit_passed': '审核通过',
      'rejected': '审核驳回',
      'completed': '已完成',
      'invoice_collected': '发票已开具'
    };
    return map[status] || status;
  };

  return (
    <div style={{ padding: 12, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/manual/index.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff', fontSize: 14 }}>
            操作说明
          </a>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>订单查询</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SearchBar 
              placeholder='请输入订单号/手机号' 
              onSearch={onSearch}
              value={searchValue}
              onChange={setSearchValue}
              style={{ '--background': '#f5f5f5' }}
            />
          </div>
          <ScanCodeOutline 
            fontSize={24} 
            color='#1677ff' 
            onClick={handleScanClick}
          />
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*" 
          capture="environment"
          onChange={handleFileChange}
        />
        
        <div style={{ marginTop: 12 }}>
          <CapsuleTabs onChange={handleTabChange}>
            <CapsuleTabs.Tab title='全部' key='all' />
            <CapsuleTabs.Tab title='待上传' key='待上传' />
            <CapsuleTabs.Tab title='上传中' key='上传中' />
            <CapsuleTabs.Tab title='已驳回' key='已驳回' />
            <CapsuleTabs.Tab title='已完成' key='已完成' />
          </CapsuleTabs>
        </div>
      </div>

      {hasSearched && orders.length === 0 && !loading && (
        <ErrorBlock status='empty' title='暂无数据' description='请尝试其他关键词' />
      )}

      {orders.map(order => (
        <Card 
          key={order.id} 
          style={{ marginBottom: 12, borderRadius: 8 }}
          onClick={() => navigate(`/mobile/upload/${order.id}`)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold', fontSize: 16 }}>{order.customer_name}</span>
            <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
          </div>
          <div style={{ color: '#666', fontSize: 14, marginBottom: 4 }}>
            商品: {order.product_name}
          </div>
          <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
            订单号: {order.mchnt_ord_no || order.crm_order_no}
          </div>
          <Button 
            block 
            color='primary' 
            size='small'
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/mobile/upload/${order.id}`);
            }}
          >
            上传资料 <RightOutline />
          </Button>
        </Card>
      ))}
    </div>
  );
};

export default Home;
