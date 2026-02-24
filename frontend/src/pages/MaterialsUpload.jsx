import React, { useState, useEffect, useCallback } from 'react';
import { Card, Upload, Button, App, Row, Col, Image, Spin, Typography, Alert, Tag, Input, Timeline, Empty, Modal } from 'antd';
import { UploadOutlined, DeleteOutlined, FileImageOutlined, ScanOutlined, HistoryOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import orderApi from '../services/orderApi';

const { Title, Text } = Typography;

// 定义各品类所需的材料配置
const getMaterialTypes = (plateType) => {
  // 根据《湖南以旧换新企业垫资审核系统数据完善接口文档V1.2》配置
  const typeConfigs = {
    // 家电
    home_appliance: [
      { key: 'delivery_note', label: '送货单照片', required: true, maxCount: 1 }, // image1
      { key: 'sn_photo', label: 'SN码水印照片', required: true, maxCount: 1 }, // image2
      { key: 'energy_label', label: '能效标识水印照片', required: true, maxCount: 1 }, // image3
      { key: 'receipt', label: '销售清单或购物小票照片', required: false, maxCount: 1 }, // image4
      { key: 'product_photo', label: '实物照片', required: false, maxCount: 1 }, // image5
    ],
    // 3C数码
    digital_3c: [
      { key: 'logistics_photo', label: '签收物流照片', required: true, maxCount: 1 }, // 新增必填
      { key: 'sn_photo', label: 'SN码水印照片', required: true, maxCount: 1 }, // image1
      { key: 'activation_photo', label: '商品激活照片', required: false, maxCount: 1 }, // image2
      { key: 'product_front', label: '商品正面照片', required: false, maxCount: 1 }, // image3
      { key: 'product_side_or_sign', label: '商品侧面照片或签收凭证照片', required: false, maxCount: 1 }, // image4
      { key: 'product_back', label: '商品背面照片', required: false, maxCount: 1 }, // image5
    ],
    // 家装
    home_decoration: [
      { key: 'receipt', label: '销售清单或购物小票照片', required: false, maxCount: 1 }, // image1
      { key: 'receiving_proof', label: '收货凭证照片（自提/商家配送/物流）', required: false, maxCount: 1 }, // image2
      { key: 'construction_before', label: '施工前照片', required: false, maxCount: 1 }, // image3
      { key: 'construction_after', label: '施工后照片', required: false, maxCount: 1 }, // image4
      { key: 'other_photo', label: '其他照片', required: false, maxCount: 1 }, // image5
    ],
    // 适老化
    aging_adaptation: [
      { key: 'sign_receipt', label: '签购单照片', required: true, maxCount: 1 }, // image1
      { key: 'delivery_note_signed', label: '送货单(签字)', required: true, maxCount: 1 }, // image2
      { key: 'delivery_photo', label: '送货照片(水印)', required: true, maxCount: 1 }, // image3
      { key: 'receipt', label: '购物小票/销售单图片', required: true, maxCount: 1 }, // image4
      { key: 'other_photo', label: '其他照片', required: false, maxCount: 1 }, // image5
    ]
  };

  return typeConfigs[plateType] || [];
};

const MaterialsUpload = () => {
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const navigate = useNavigate();
  
  const [order, setOrder] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [uploading, setUploading] = useState({});
  const [snCode, setSnCode] = useState('');
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrderDetails = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data);
      if (res.data.sn_code) setSnCode(res.data.sn_code);
      if (res.data.imei1) setImei1(res.data.imei1);
      if (res.data.imei2) setImei2(res.data.imei2);
    } catch (error) {
      console.error('获取订单详情失败', error);
      message.error('获取订单详情失败');
    }
  }, [orderId, message]);

  const fetchMaterials = useCallback(async () => {
    try {
      const res = await api.get(`/materials/order/${orderId}`);
      setMaterials(res.data);
    } catch (error) {
      console.error('获取资料列表失败', error);
    }
  }, [orderId]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const logs = await orderApi.getAuditLogs(orderId);
      setAuditLogs(logs);
    } catch (error) {
      console.error('获取审核记录失败', error);
    } finally {
      setLogsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      return;
    }
    fetchOrderDetails();
    fetchMaterials();
    fetchAuditLogs();
  }, [orderId, fetchOrderDetails, fetchMaterials, fetchAuditLogs]);

  const saveSnCode = async (code) => {
    if (!code) return true;
    try {
      await api.patch(`/orders/${orderId}`, { snCode: code });
      message.success('SN码已保存');
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        Modal.error({
          title: 'SN码重复',
          content: `SN码 ${code} 已存在于订单 ${error.response.data.conflictOrder} 中，请检查！`,
          okText: '知道了'
        });
      } else {
        message.error('SN码保存失败');
      }
      return false;
    }
  };

  const saveImei1 = async (code) => {
    if (!code) return true;
    try {
      await api.patch(`/orders/${orderId}`, { imei1: code });
      message.success('IMEI1已保存');
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        Modal.error({
          title: 'IMEI1重复',
          content: `IMEI1 ${code} 已存在于订单 ${error.response.data.conflictOrder} 中，请检查！`,
          okText: '知道了'
        });
      } else {
        message.error('IMEI1保存失败');
      }
      return false;
    }
  };

  const saveImei2 = async (code) => {
    if (!code) return true;
    try {
      await api.patch(`/orders/${orderId}`, { imei2: code });
      message.success('IMEI2已保存');
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        Modal.error({
          title: 'IMEI2重复',
          content: `IMEI2 ${code} 已存在于订单 ${error.response.data.conflictOrder} 中，请检查！`,
          okText: '知道了'
        });
      } else {
        message.error('IMEI2保存失败');
      }
      return false;
    }
  };

  const handleSubmitAudit = async () => {
    const configs = getMaterialTypes(order?.plate_type);
    const requiredConfigs = configs.filter(c => c.required);
    const missingConfigs = requiredConfigs.filter(c => !materials.some(m => m.material_type === c.key));
    const needSn = requiredConfigs.some(c => c.key === 'sn_photo');
    const snVal = snCode || order?.sn_code || imei1 || order?.imei1; // Check existing values

    if (missingConfigs.length || (needSn && !snVal)) {
      const items = [...missingConfigs.map(c => c.label)];
      if (needSn && !snVal) items.push('SN码或IMEI码');
      Modal.warning({
        title: '提交审核前需完善资料',
        content: items.join('、')
      });
      return;
    }
    Modal.confirm({
      title: '确认提交审核',
      content: '提交后将进入审核流程，确认订单资料已全部上传完成？',
      okText: '确认提交',
      cancelText: '取消',
      okButtonProps: { loading: submitting },
      onOk: async () => {
        setSubmitting(true);
        try {
          // 提交前确保保存最新的码值
          if (snCode) {
            const success = await saveSnCode(snCode);
            if (!success) throw new Error('SN码校验失败');
          }
          if (imei1) {
            const success = await saveImei1(imei1);
            if (!success) throw new Error('IMEI1校验失败');
          }
          if (imei2) {
            const success = await saveImei2(imei2);
            if (!success) throw new Error('IMEI2校验失败');
          }

          await orderApi.submitAudit(orderId);
          message.success('提交审核成功');
          navigate('/orders');
        } catch (error) {
          if (!['SN码校验失败', 'IMEI1校验失败', 'IMEI2校验失败'].includes(error.message)) {
            message.error(error.response?.data?.error || '提交审核失败');
          }
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  if (!orderId) {
    return (
      <Card>
        <Alert
          message="缺少订单ID"
          description="请从订单管理页面选择需要上传资料的订单。"
          type="warning"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/orders')}>
              前往订单管理
            </Button>
          }
        />
      </Card>
    );
  }

  const handleUpload = async ({ file, materialType, imageIndex = 0 }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orderId', orderId);
    formData.append('materialType', materialType);
    formData.append('imageIndex', imageIndex);

    setUploading(prev => ({ ...prev, [`${materialType}-${imageIndex}`]: true }));

    try {
      const res = await api.post('/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('上传成功');
      
      // 如果是SN码照片，尝试进行OCR识别
      if (materialType === 'sn_photo') {
        try {
          message.loading({ content: '正在进行OCR识别...', key: 'ocr' });
          const ocrRes = await api.post(`/ocr/materials/${res.data.material.id}/process`, {
            ocrType: 'sn'
          });
          
          if (ocrRes.data.success && ocrRes.data.ocrResult) {
            setSnCode(ocrRes.data.ocrResult);
            message.success({ content: `OCR识别成功: ${ocrRes.data.ocrResult}`, key: 'ocr' });
          } else {
            message.warning({ content: 'OCR未能识别出有效内容，请手动输入', key: 'ocr' });
          }
        } catch (ocrError) {
          console.error('OCR识别失败', ocrError);
          message.warning({ content: 'OCR识别失败，请手动输入', key: 'ocr' });
        }
      } else if (materialType === 'imei_photo') {
        try {
          message.loading({ content: '正在进行IMEI识别...', key: 'ocr' });
          const ocrRes = await api.post(`/ocr/materials/${res.data.material.id}/process`, {
            ocrType: 'imei'
          });
          
          if (ocrRes.data.success && ocrRes.data.ocrResult) {
             // Result is a JSON string
             try {
                const imeiData = JSON.parse(ocrRes.data.ocrResult);
                let msg = 'IMEI识别成功';
                if (imeiData.imei1) {
                  setImei1(imeiData.imei1);
                  msg += ` IMEI1: ${imeiData.imei1}`;
                }
                if (imeiData.imei2) {
                  setImei2(imeiData.imei2);
                  msg += ` IMEI2: ${imeiData.imei2}`;
                }
                message.success({ content: msg, key: 'ocr' });
             } catch (e) {
                console.error('IMEI JSON parse error', e);
                message.warning({ content: 'IMEI识别结果格式错误', key: 'ocr' });
             }
          } else {
            message.warning({ content: '未识别出IMEI，请手动输入', key: 'ocr' });
          }
        } catch (ocrError) {
          console.error('IMEI识别失败', ocrError);
          message.warning({ content: 'IMEI识别失败，请手动输入', key: 'ocr' });
        }
      }
      
      fetchMaterials();
    } catch (error) {
      console.error('上传失败', error);
      message.error('上传失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(prev => ({ ...prev, [`${materialType}-${imageIndex}`]: false }));
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/materials/${id}`);
      message.success('删除成功');
      fetchMaterials();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getMaterialsByType = (type) => {
    return materials.filter(m => m.material_type === type).sort((a, b) => a.image_index - b.image_index);
  };

  const renderUploadSection = (typeConfig) => {
    const currentMaterials = getMaterialsByType(typeConfig.key);
    
    // 生成上传槽位
    const slots = [];
    for (let i = 0; i < typeConfig.maxCount; i++) {
      const material = currentMaterials.find(m => m.image_index === i || (currentMaterials.length === 1 && i === 0)); // 简单处理索引
      
      slots.push(
        <Col xs={24} sm={12} md={24 / typeConfig.maxCount} key={i} style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">{typeConfig.label} {typeConfig.maxCount > 1 ? `(${i + 1})` : ''}</Text>
          </div>
          
          {material ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Image
                width={200}
                height={150}
                src={material.file_url}
                fallback="https://via.placeholder.com/200x150?text=Image+Error"
                style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
              />
              <Button 
                type="primary" 
                danger 
                shape="circle" 
                icon={<DeleteOutlined />} 
                size="small"
                style={{ position: 'absolute', top: 5, right: 5 }}
                onClick={() => handleDelete(material.id)}
              />
              <div style={{ marginTop: 8 }}>
                <Tag color="success">已上传</Tag>
              </div>
            </div>
          ) : (
            <Upload
              customRequest={({ file }) => handleUpload({ file, materialType: typeConfig.key, imageIndex: i })}
              showUploadList={false}
              accept="image/*"
              disabled={uploading[`${typeConfig.key}-${i}`]}
            >
              <div style={{ 
                width: 200, 
                height: 150, 
                border: '1px dashed #d9d9d9', 
                borderRadius: 8, 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: '#fafafa'
              }}>
                {uploading[`${typeConfig.key}-${i}`] ? (
                  <Spin />
                ) : (
                  <>
                    <FileImageOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
                    <Text type="secondary">点击上传</Text>
                  </>
                )}
              </div>
            </Upload>
          )}
        </Col>
      );
    }

    return (
      <Card 
        key={typeConfig.key} 
        title={<>
          {typeConfig.label} 
          {typeConfig.required ? (
             <Text type="danger" style={{ marginLeft: 8 }}>(必填)</Text>
          ) : (
             <Text type="secondary" style={{ marginLeft: 8 }}>(选填)</Text>
          )}
        </>} 
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          {slots}
        </Row>
        
        {typeConfig.key === 'sn_photo' && (
          <div style={{ marginTop: 16 }}>
            <Text>SN码 (OCR自动识别/手动输入):</Text>
            <Input 
              prefix={<ScanOutlined />}
              placeholder="请输入或等待OCR识别SN码" 
              value={snCode} 
              onChange={(e) => setSnCode(e.target.value)}
              onBlur={() => saveSnCode(snCode)}
              style={{ marginTop: 8 }}
              allowClear
            />
            
            {/* 3C数码增加IMEI部分 */}
            {order?.plate_type === 'digital_3c' && (
               <div style={{ marginTop: 16, borderTop: '1px dashed #eee', paddingTop: 16 }}>
                 <div style={{ marginBottom: 12 }}>
                   <Text strong>IMEI信息 (仅3C数码)</Text>
                 </div>
                 
                 <Row gutter={16}>
                   <Col xs={24} sm={12}>
                     <Text>IMEI照片 (用于自动识别):</Text>
                     <div style={{ marginTop: 8, marginBottom: 8 }}>
                       {getMaterialsByType('imei_photo').length > 0 ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <Image
                              width={120}
                              height={90}
                              src={getMaterialsByType('imei_photo')[0].file_url}
                              style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                            />
                             <Button 
                                type="primary" 
                                danger 
                                shape="circle" 
                                icon={<DeleteOutlined />} 
                                size="small"
                                style={{ position: 'absolute', top: 5, right: 5 }}
                                onClick={() => handleDelete(getMaterialsByType('imei_photo')[0].id)}
                              />
                          </div>
                       ) : (
                         <Upload
                           customRequest={({ file }) => handleUpload({ file, materialType: 'imei_photo', imageIndex: 0 })}
                           showUploadList={false}
                           accept="image/*"
                           disabled={uploading['imei_photo-0']}
                         >
                            <Button icon={<UploadOutlined />} loading={uploading['imei_photo-0']}>
                               上传IMEI照片自动识别
                            </Button>
                         </Upload>
                       )}
                     </div>
                   </Col>
                   <Col xs={24} sm={12}>
                     <Text>IMEI1:</Text>
                     <Input 
                       prefix={<ScanOutlined />}
                       placeholder="OCR识别或手动输入IMEI1" 
                       value={imei1} 
                       onChange={(e) => setImei1(e.target.value)}
                       onBlur={() => saveImei1(imei1)}
                       style={{ marginTop: 8, marginBottom: 8 }}
                       allowClear
                     />
                     <Text>IMEI2:</Text>
                     <Input 
                       prefix={<ScanOutlined />}
                       placeholder="OCR识别或手动输入IMEI2" 
                       value={imei2} 
                       onChange={(e) => setImei2(e.target.value)}
                       onBlur={() => saveImei2(imei2)}
                       style={{ marginTop: 8 }}
                       allowClear
                     />
                   </Col>
                 </Row>
               </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  if (!order) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 50 }} />;

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4}>订单资料上传</Title>
            <Text>订单号: {order.mchnt_ord_no} | 快乐购单号: {order.crm_order_no || '-'} | 商品: {order.product_name} | 品牌: {order.product_brand || '-'} | 型号: {order.product_model || '-'}</Text>
          </Col>
          <Col>
             <Button onClick={() => navigate('/orders')}>返回列表</Button>
          </Col>
        </Row>
      </Card>

      <Alert 
        message="上传说明" 
        description="请确保照片清晰，文字可辨识。支持 jpg, png 格式，单张不超过 5MB。" 
        type="info" 
        showIcon 
        style={{ marginBottom: 24 }} 
      />

      {getMaterialTypes(order.plate_type).map(renderUploadSection)}
      
      <Card 
        title={<><HistoryOutlined /> 操作记录</>} 
        style={{ marginBottom: 24 }}
      >
        {logsLoading ? (
          <Spin tip="加载中..." />
        ) : auditLogs.length === 0 ? (
          <Empty description="暂无操作记录" />
        ) : (
          <Timeline>
            {auditLogs.map((log) => (
              <Timeline.Item
                key={log.id}
                color={
                  log.action === 'audit' 
                    ? log.new_status === 'approved' 
                      ? 'green' 
                      : 'red'
                    : 'blue'
                }
              >
                <div>
                  <Text strong>
                    {log.action === 'audit' 
                      ? log.new_status === 'approved' 
                        ? '审核通过' 
                        : '审核驳回'
                      : log.action === 'upload'
                      ? '资料上传'
                      : '提交审核'}
                  </Text>
                  <br />
                  <Text type="secondary">
                    {log.real_name || log.username || '系统'} - {new Date(log.created_at).toLocaleString('zh-CN')}
                  </Text>
                  {log.remark && (
                    <>
                      <br />
                      <Text>{log.remark}</Text>
                    </>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
      
      <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 40 }}>
        <Button type="primary" size="large" onClick={async () => {
          try {
            // 保存各项码值，遇到失败则终止
             if (snCode) {
                const success = await saveSnCode(snCode);
                if (!success) return;
             }
             if (imei1) {
                const success = await saveImei1(imei1);
                if (!success) return;
             }
             if (imei2) {
                const success = await saveImei2(imei2);
                if (!success) return;
             }
             
             message.success('资料已保存');
            navigate('/orders');
          } catch (error) {
            console.error('保存失败', error);
            message.error('保存失败');
          }
        }}>
          保存资料
        </Button>
        <Button type="primary" size="large" style={{ marginLeft: 12 }} loading={submitting} onClick={handleSubmitAudit}>
          提交审核
        </Button>
      </div>
    </div>
  );
};

export default MaterialsUpload;
