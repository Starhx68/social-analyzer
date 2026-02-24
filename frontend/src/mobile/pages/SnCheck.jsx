import React, { useState, useRef } from 'react';
import { Card, Input, Button, Toast, Image, Space, Modal, Result, Tag } from 'antd-mobile';
import { SearchOutline, CameraOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// 自定义图标组件
const CheckIcon = ({ color, fontSize }) => (
  <svg viewBox="0 0 1024 1024" version="1.1" width={fontSize} height={fontSize} fill={color}>
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m236.8 388.8l-281.6 281.6c-12.8 12.8-33.6 12.8-46.4 0L288 598.4c-12.8-12.8-12.8-33.6 0-46.4l28.8-28.8c12.8-12.8 33.6-12.8 46.4 0L432 592l332.8-332.8c12.8-12.8 33.6-12.8 46.4 0l28.8 28.8c12.8 12.8 12.8 33.6 0 46.4z" />
  </svg>
);

const CloseIcon = ({ color, fontSize }) => (
  <svg viewBox="0 0 1024 1024" version="1.1" width={fontSize} height={fontSize} fill={color}>
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m165.2 300.8l-132 132 132 132c12.8 12.8 12.8 33.6 0 46.4l-46.4 46.4c-12.8 12.8-33.6 12.8-46.4 0L512 589.2l-132 132c-12.8 12.8-33.6 12.8-46.4 0l-46.4-46.4c-12.8-12.8-12.8-33.6 0-46.4L419.2 496l-132-132c-12.8-12.8-12.8-33.6 0-46.4l46.4-46.4c12.8-12.8 33.6-12.8 46.4 0L512 402.8l132-132c12.8-12.8 33.6-12.8 46.4 0l46.4 46.4c12.8 12.8 12.8 33.6 0 46.4z" />
  </svg>
);

const SnCheck = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [orderNo, setOrderNo] = useState('');
  const [snCode, setSnCode] = useState('');
  const [snImageFile, setSnImageFile] = useState(null);
  const [snImageUrl, setSnImageUrl] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [querying, setQuerying] = useState(false);
  const [locking, setLocking] = useState(false);

  // 处理图片选择
  const handleImageSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 处理文件变化
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 重置input
    e.target.value = '';

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      Toast.show({ icon: 'fail', content: '只能上传图片文件' });
      return;
    }

    // 检查文件大小
    if (file.size / 1024 / 1024 > 5) {
      Toast.show({ icon: 'fail', content: '图片大小不能超过5MB' });
      return;
    }

    setSnImageFile(file);
    setSnImageUrl(URL.createObjectURL(file));

    // 自动进行OCR识别
    performOcr(file);
  };

  // OCR识别SN码
  const performOcr = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    Toast.show({ icon: 'loading', content: '正在识别SN码...', duration: 0 });

    try {
      const res = await api.post('/ocr/sn', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Toast.clear();

      if (res.data.success && res.data.results && res.data.results.length > 0) {
        const ocrText = res.data.results[0].text;
        setSnCode(ocrText);
        Toast.show({ icon: 'success', content: `OCR识别成功: ${ocrText}` });
      } else {
        Toast.show({ icon: 'warn', content: 'OCR未能识别出有效内容，请手动输入' });
      }
    } catch (error) {
      Toast.clear();
      console.error('OCR识别失败', error);
      Toast.show({ icon: 'fail', content: 'OCR识别失败，请手动输入' });
    }
  };

  // 查询SN状态
  const handleQuery = async () => {
    if (!orderNo) {
      Toast.show({ icon: 'fail', content: '请输入订单号' });
      return;
    }

    if (!snCode) {
      Toast.show({ icon: 'fail', content: '请输入SN码' });
      return;
    }

    setQuerying(true);
    setQueryResult(null);

    try {
      const res = await api.post('/sn/query', { orderNo, sn: snCode });

      if (res.data.success) {
        setQueryResult({
          success: true,
          sellState: res.data.sellState,
          message: res.data.message,
          data: res.data.data
        });
      } else {
        setQueryResult({
          success: false,
          message: res.data.message
        });
        Toast.show({ icon: 'fail', content: 'SN码不可售' });
      }
    } catch (error) {
      console.error('查询失败', error);
      const errorMsg = error.response?.data?.error || error.message || '查询失败';
      setQueryResult({
        success: false,
        message: errorMsg
      });
      Toast.show({ icon: 'fail', content: errorMsg });
    } finally {
      setQuerying(false);
    }
  };

  // 锁定SN
  const handleLock = async () => {
    if (!queryResult?.success) {
      Toast.show({ icon: 'fail', content: 'SN码不可售，无法锁定' });
      return;
    }

    setLocking(true);

    try {
      const formData = new FormData();
      formData.append('orderNo', orderNo);
      formData.append('sn', snCode);
      if (snImageFile) {
        formData.append('image', snImageFile);
      }

      const res = await api.post('/sn/lock', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        Toast.show({ icon: 'success', content: 'SN码锁定成功' });
        // 重置表单
        setOrderNo('');
        setSnCode('');
        setSnImageFile(null);
        setSnImageUrl('');
        setQueryResult(null);
      } else {
        Toast.show({ icon: 'fail', content: res.data.message || '锁定失败' });
      }
    } catch (error) {
      console.error('锁定失败', error);
      const errorMsg = error.response?.data?.error || error.message || '锁定失败';
      Toast.show({ icon: 'fail', content: errorMsg });
    } finally {
      setLocking(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    setOrderNo('');
    setSnCode('');
    setSnImageFile(null);
    setSnImageUrl('');
    setQueryResult(null);
  };

  // 显示结果弹窗
  const showResultModal = () => {
    if (!queryResult) return;

    Modal.show({
      content: (
        <Result
          status={queryResult.success ? 'success' : 'error'}
          title={queryResult.success ? 'SN码可售' : 'SN码不可售'}
          description={queryResult.message}
        />
      ),
      closeOnMaskClick: true,
      closeOnClick: true,
      actions: queryResult.success ? [
        {
          key: 'lock',
          text: '锁定SN',
          primary: true,
          onClick: handleLock
        },
        {
          key: 'cancel',
          text: '取消'
        }
      ] : [
        {
          key: 'close',
          text: '关闭'
        }
      ]
    });
  };

  return (
    <div style={{ padding: 12, background: '#f5f5f5', minHeight: '100vh' }}>
      <Card title="SN码查询与锁定" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
          此功能仅适用于3C数码类产品。请输入订单号和SN码进行查询，查询成功后可锁定SN码。
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, color: '#333' }}>
            订单号 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <Input
            placeholder="请输入订单号"
            value={orderNo}
            onChange={(val) => setOrderNo(val)}
            clearable
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, color: '#333' }}>
            SN码 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="请输入SN码或拍照识别"
              value={snCode}
              onChange={(val) => setSnCode(val)}
              clearable
              style={{ flex: 1 }}
            />
            <Button
              color="primary"
              size="large"
              onClick={handleImageSelect}
              style={{ padding: '0 16px' }}
            >
              <CameraOutline fontSize={20} />
            </Button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />
        </div>

        {snImageUrl && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, marginBottom: 8, color: '#333' }}>SN码照片预览</div>
            <Image
              src={snImageUrl}
              width="100%"
              style={{ borderRadius: 8 }}
              fit="cover"
            />
          </div>
        )}

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            color="primary"
            size="large"
            onClick={handleQuery}
            loading={querying}
          >
            <SearchOutline /> 查询SN
          </Button>
          <Button
            block
            size="large"
            onClick={handleReset}
          >
            重置
          </Button>
        </Space>
      </Card>

      {queryResult && !querying && (
        <Card
          style={{
            backgroundColor: queryResult.success ? '#f6ffed' : '#fff2f0',
            borderColor: queryResult.success ? '#b7eb8f' : '#ffccc7'
          }}
          onClick={showResultModal}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            {queryResult.success ? (
              <CheckIcon fontSize={32} color="#52c41a" />
            ) : (
              <CloseIcon fontSize={32} color="#ff4d4f" />
            )}
            <div style={{ marginLeft: 12, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
                {queryResult.success ? 'SN码可售' : 'SN码不可售'}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                {queryResult.message}
              </div>
            </div>
          </div>

          {queryResult.success && (
            <div style={{ marginBottom: 12 }}>
              <Tag color="success">状态码: {queryResult.sellState}</Tag>
              {queryResult.data?.sellStateDesc && (
                <Tag color="processing">{queryResult.data.sellStateDesc}</Tag>
              )}
            </div>
          )}

          <Button
            block
            color="primary"
            size="large"
            onClick={handleLock}
            loading={locking}
            disabled={!queryResult.success}
          >
            锁定SN
          </Button>
        </Card>
      )}

      {/* 返回首页按钮 */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button
          size="large"
          onClick={() => navigate('/mobile/home')}
          style={{ width: '100%' }}
        >
          返回首页
        </Button>
      </div>
    </div>
  );
};

export default SnCheck;
