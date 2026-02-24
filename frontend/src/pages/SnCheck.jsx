import React, { useState } from 'react';
import { Card, Form, Input, Button, Upload, Alert, Space, Typography, Spin, Image, message, Result, Tag } from 'antd';
import { ScanOutlined, SearchOutlined, CameraOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;

const SnCheck = () => {
  const [form] = Form.useForm();
  const [orderNo, setOrderNo] = useState('');
  const [snCode, setSnCode] = useState('');
  const [snImageFile, setSnImageFile] = useState(null);
  const [snImageUrl, setSnImageUrl] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [querying, setQuerying] = useState(false);
  const [locking, setLocking] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);

  // 处理图片上传前
  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过5MB');
      return false;
    }
    return true;
  };

  // 处理图片选择
  const handleImageChange = (info) => {
    const { fileList } = info;
    if (fileList.length > 0) {
      const file = fileList[0].originFileObj;
      setSnImageFile(file);
      setSnImageUrl(URL.createObjectURL(file));

      // 自动进行OCR识别
      performOcr(file);
    } else {
      setSnImageFile(null);
      setSnImageUrl('');
    }
  };

  // OCR识别SN码
  const performOcr = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    message.loading({ content: '正在识别SN码...', key: 'ocr' });

    try {
      const res = await api.post('/ocr/sn', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.results && res.data.results.length > 0) {
        const ocrText = res.data.results[0].text;
        setSnCode(ocrText);
        message.success({ content: `OCR识别成功: ${ocrText}`, key: 'ocr' });
      } else {
        message.warning({ content: 'OCR未能识别出有效内容，请手动输入', key: 'ocr' });
      }
    } catch (error) {
      console.error('OCR识别失败', error);
      message.warning({ content: 'OCR识别失败，请手动输入', key: 'ocr' });
    }
  };

  // 查询SN状态
  const handleQuery = async () => {
    if (!orderNo || !snCode) {
      message.warning('请输入订单号和SN码');
      return;
    }

    setQuerying(true);
    setQueryResult(null);
    setOrderInfo(null);

    try {
      const res = await api.post('/sn/query', { orderNo, sn: snCode });

      if (res.data.success) {
        setQueryResult({
          success: true,
          sellState: res.data.sellState,
          message: res.data.message,
          data: res.data.data
        });
        message.success('SN码可售，可以锁定');
      } else {
        setQueryResult({
          success: false,
          message: res.data.message
        });
        message.warning('SN码不可售');
      }
    } catch (error) {
      console.error('查询失败', error);
      const errorMsg = error.response?.data?.error || error.message || '查询失败';
      setQueryResult({
        success: false,
        message: errorMsg
      });
      message.error(errorMsg);
    } finally {
      setQuerying(false);
    }
  };

  // 锁定SN
  const handleLock = async () => {
    if (!queryResult?.success) {
      message.warning('SN码不可售，无法锁定');
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
        message.success('SN码锁定成功');
        // 重置表单
        form.resetFields();
        setOrderNo('');
        setSnCode('');
        setSnImageFile(null);
        setSnImageUrl('');
        setQueryResult(null);
        setOrderInfo(null);
      } else {
        message.error(res.data.message || '锁定失败');
      }
    } catch (error) {
      console.error('锁定失败', error);
      const errorMsg = error.response?.data?.error || error.message || '锁定失败';
      message.error(errorMsg);
    } finally {
      setLocking(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    form.resetFields();
    setOrderNo('');
    setSnCode('');
    setSnImageFile(null);
    setSnImageUrl('');
    setQueryResult(null);
    setOrderInfo(null);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>SN码查询与锁定</Title>
        <Paragraph type="secondary">
          此功能仅适用于3C数码类产品。请输入订单号和SN码进行查询，查询成功后可锁定SN码。
        </Paragraph>

        <Alert
          message="操作说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>输入订单号和SN码（支持OCR自动识别）</li>
              <li>点击"查询SN"按钮查询SN码状态</li>
              <li>查询结果显示"可售"时，"锁定SN"按钮变为可用</li>
              <li>点击"锁定SN"完成锁定，SN码和照片将自动保存到订单资料中</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item
            label="订单号"
            required
            rules={[{ required: true, message: '请输入订单号' }]}
          >
            <Input
              placeholder="请输入订单号（商户订单号或CRM订单号）"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              prefix={<SearchOutlined />}
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="SN码"
            required
            rules={[{ required: true, message: '请输入或OCR识别SN码' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="请输入SN码或拍照识别"
                value={snCode}
                onChange={(e) => setSnCode(e.target.value)}
                prefix={<ScanOutlined />}
                size="large"
                style={{ flex: 1 }}
              />
              <Upload
                beforeUpload={beforeUpload}
                customRequest={({ onSuccess }) => onSuccess('ok')}
                onChange={handleImageChange}
                showUploadList={false}
                accept="image/*"
                capture="environment"
              >
                <Button type="primary" size="large" icon={<CameraOutlined />}>
                  拍照识别
                </Button>
              </Upload>
            </Space.Compact>
          </Form.Item>

          {snImageUrl && (
            <Form.Item label="SN码照片预览">
              <Image
                width={200}
                src={snImageUrl}
                style={{ borderRadius: 8, border: '1px solid #d9d9d9' }}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                size="large"
                icon={<SearchOutlined />}
                onClick={handleQuery}
                loading={querying}
              >
                查询SN
              </Button>
              <Button size="large" onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {querying && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="正在查询SN状态..." />
          </div>
        )}

        {queryResult && !querying && (
          <Card
            style={{
              marginTop: 24,
              backgroundColor: queryResult.success ? '#f6ffed' : '#fff2f0',
              borderColor: queryResult.success ? '#b7eb8f' : '#ffccc7'
            }}
          >
            {queryResult.success ? (
              <Result
                icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 72 }} />}
                title="SN码可售"
                subTitle={queryResult.message}
                extra={
                  <>
                    {queryResult.data && (
                      <div style={{ marginBottom: 16 }}>
                        <Tag color="success">状态码: {queryResult.sellState}</Tag>
                        {queryResult.data.sellStateDesc && (
                          <Tag color="processing">{queryResult.data.sellStateDesc}</Tag>
                        )}
                      </div>
                    )}
                    <Button
                      type="primary"
                      size="large"
                      onClick={handleLock}
                      loading={locking}
                      icon={<CheckCircleOutlined />}
                    >
                      锁定SN
                    </Button>
                  </>
                }
              />
            ) : (
              <Result
                icon={<CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 72 }} />}
                title="SN码不可售"
                subTitle={queryResult.message}
                status="error"
              />
            )}
          </Card>
        )}

        {locking && (
          <Alert
            message="正在锁定SN码，请稍候..."
            type="info"
            showIcon
            icon={<LoadingOutlined />}
            style={{ marginTop: 24 }}
          />
        )}
      </Card>
    </div>
  );
};

export default SnCheck;
