import React, { useState, useEffect } from 'react';
import { NavBar, Card, Form, Input, Button, Toast, Tag, Dialog, ImageViewer } from 'antd-mobile';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getOrderDetail, patchOrder, submitAudit } from '../../services/orderApi';
// Removed compressImage import as we now use native file upload

// Reusing configuration logic
const getMaterialTypes = (plateType) => {
  const typeConfigs = {
    // 家电
    home_appliance: [
      { key: 'invoice', label: '发票照片', required: true, maxCount: 1 },
      { key: 'delivery_note', label: '送货单照片', required: true, maxCount: 1 },
      { key: 'sn_photo', label: 'SN码水印照片', required: true, maxCount: 1 },
      { key: 'energy_label', label: '能效标识水印照片', required: false, maxCount: 1 },
      { key: 'receipt', label: '销售清单或购物小票照片', required: false, maxCount: 1 },
      { key: 'product_photo', label: '实物照片', required: false, maxCount: 1 },
    ],
    // 3C数码
    digital_3c: [
      { key: 'logistics_photo', label: '签收物流照片', required: true, maxCount: 1 },
      { key: 'invoice', label: '发票照片', required: true, maxCount: 1 },
      { key: 'sn_photo', label: 'SN码水印照片', required: true, maxCount: 1 },
      { key: 'activation_photo', label: '商品激活照片', required: false, maxCount: 1 },
      { key: 'product_front', label: '商品正面照片', required: false, maxCount: 1 },
      { key: 'product_side_or_sign', label: '商品侧面照片或签收凭证照片', required: false, maxCount: 1 },
      { key: 'product_back', label: '商品背面照片', required: false, maxCount: 1 },
      { key: 'imei_photo', label: 'IMEI码照片', required: false, maxCount: 1 },
    ],
    // 家装
    home_decoration: [
      { key: 'invoice', label: '发票照片', required: true, maxCount: 1 },
      { key: 'receipt', label: '销售清单或购物小票照片', required: false, maxCount: 1 },
      { key: 'receiving_proof', label: '收货凭证照片', required: false, maxCount: 1 },
      { key: 'construction_before', label: '施工前照片', required: false, maxCount: 1 },
      { key: 'construction_after', label: '施工后照片', required: false, maxCount: 1 },
      { key: 'other_photo', label: '其他照片', required: false, maxCount: 1 },
    ],
    // 适老化
    aging_adaptation: [
      { key: 'invoice', label: '发票照片', required: true, maxCount: 1 },
      { key: 'sign_receipt', label: '签购单照片', required: true, maxCount: 1 },
      { key: 'delivery_note_signed', label: '送货单(签字)', required: true, maxCount: 1 },
      { key: 'delivery_photo', label: '送货照片(水印)', required: true, maxCount: 1 },
      { key: 'receipt', label: '购物小票/销售单图片', required: true, maxCount: 1 },
      { key: 'other_photo', label: '其他照片', required: false, maxCount: 1 },
    ]
  };

  return typeConfigs[plateType] || [];
};

const UploadPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [snCode, setSnCode] = useState('');
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState('');

  // Helper to fix localhost URLs for mobile access
  const fixUrl = (url) => {
    if (!url) return url;
    // Replace localhost with window.location.hostname
    return url.replace('localhost', window.location.hostname);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const orderRes = await getOrderDetail(id);
      setOrder(orderRes);
      setSnCode(orderRes.sn_code || '');
      setImei1(orderRes.imei1 || '');
      setImei2(orderRes.imei2 || '');

      const matRes = await api.get(`/materials/order/${id}`);
      // Fix URLs in fetched materials
      const fixedMaterials = (matRes.data || []).map(m => ({
        ...m,
        file_url: fixUrl(m.file_url)
      }));
      setMaterials(fixedMaterials);
    } catch (error) {
      Toast.show({ icon: 'fail', content: '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file, materialType) => {
    let uploadFile = file;
    
    // Direct upload without client-side compression (Native H5 mode)
    // Backend supports large files (up to 50MB)
    console.log(`Uploading file: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('orderId', id);
    formData.append('materialType', materialType);
    
    // Calculate image index (append to end)
    // Filter out temporary items (those with non-numeric IDs usually, or just check length of validated items)
    // Actually, simply using length is fine, but we should be careful if handleFileChange already added a temp item.
    // Let's count only items that have a 'real' URL (http/https) to avoid counting the currently uploading blob.
    const currentTypeFiles = materials.filter(m => m.material_type === materialType && m.file_url && m.file_url.startsWith('http'));
    const imageIndex = currentTypeFiles.length;
    formData.append('imageIndex', imageIndex);

    try {
      console.log('Uploading file...', file.name, file.size);
      Toast.show({ icon: 'loading', content: '上传中...', duration: 0 }); // duration 0 to persist
      
      const res = await api.post('/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Upload success', res.data);
      // Toast.clear();
      // Toast.show({ icon: 'success', content: '上传成功' });
      
      // Update local state immediately
      const newMaterial = res.data.material;
      const fixedMaterial = {
        ...newMaterial,
        file_url: fixUrl(newMaterial.file_url)
      };
      
      setMaterials(prev => {
        // Remove any temporary items for this type (optional, but cleaner) and add the real one
        // Actually handleFileChange handles the list, but we want to ensure we have the real data.
        // We simply add it. The key match in handleFileChange will take care of the rest if keys match.
        // But here key changes from temp to real ID.
        return [...prev.filter(m => m.id !== newMaterial.id), fixedMaterial];
      });
      
      Toast.clear();
      Toast.show({ icon: 'success', content: '上传成功' });

      // Trigger OCR asynchronously (do not await to avoid blocking upload success feedback)
      if (materialType === 'sn_photo' || materialType === 'imei_photo') {
        // Use a self-executing async function to handle OCR in background
        (async () => {
          // Wait a bit to let user see "Upload Success"
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          Toast.show({ icon: 'loading', content: '正在识别...', duration: 0 });
          try {
            const ocrRes = await api.post(`/ocr/materials/${newMaterial.id}/process`, {
              ocrType: materialType === 'sn_photo' ? 'sn' : 'imei'
            });

            Toast.clear();
            if (ocrRes.data.success && ocrRes.data.ocrResult) {
              const result = ocrRes.data.ocrResult;
              console.log('OCR Result:', result);
              
              if (materialType === 'sn_photo') {
                setSnCode(result);
                Toast.show({ icon: 'success', content: `SN识别成功` });
              } else if (materialType === 'imei_photo') {
                try {
                  const imeiData = JSON.parse(result);
                  if (imeiData.imei1) setImei1(imeiData.imei1);
                  if (imeiData.imei2) setImei2(imeiData.imei2);
                  Toast.show({ icon: 'success', content: 'IMEI识别成功' });
                } catch (e) {
                  console.error('IMEI JSON parse error', e);
                }
              }
            } else {
              Toast.show({ content: '未识别到有效信息', duration: 2000 });
            }
          } catch (ocrError) {
            Toast.clear();
            console.error('OCR error', ocrError);
            // Detailed error for debugging
            const errorMsg = ocrError.response?.data?.error?.message || ocrError.message || '识别服务异常';
            Toast.show({ content: `识别失败: ${errorMsg}`, duration: 3000 });
          }
        })();
      }
      
      return {
        url: fixedMaterial.file_url,
        key: fixedMaterial.id
      };
    } catch (error) {
      console.error('Upload error:', error);
      Toast.clear();
      
      // Extract detailed error message
      let errorMessage = '上传失败';
      if (error.response) {
        // Server responded with a status code outside 2xx
        if (error.response.data && error.response.data.error) {
           errorMessage = typeof error.response.data.error === 'object' 
             ? error.response.data.error.message 
             : error.response.data.error;
        } else {
           errorMessage = `上传失败 (${error.response.status})`;
        }
      } else if (error.request) {
        // Request made but no response received
        errorMessage = '网络错误，请检查网络连接';
      } else {
        // Error setting up request
        errorMessage = error.message;
      }
      
      Toast.show({ icon: 'fail', content: errorMessage, duration: 3000 });
      throw error;
    }
  };

  const handleDelete = async (material) => {
    try {
      await api.delete(`/materials/${material.id}`);
      setMaterials(prev => prev.filter(m => m.id !== material.id));
      Toast.show({ icon: 'success', content: '删除成功' });
    } catch (error) {
      Toast.show({ icon: 'fail', content: '删除失败' });
    }
  };

  const handleSaveInfo = async () => {
    try {
      await patchOrder(id, { 
        sn_code: snCode,
        imei1: imei1,
        imei2: imei2
      });
      Toast.show({ icon: 'success', content: '保存成功' });
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.conflictOrder) {
        Dialog.alert({
          header: 'SN码/IMEI重复',
          content: `该号码已被订单 ${error.response.data.conflictOrder} 使用`,
          confirmText: '我知道了'
        });
      } else {
        Toast.show({ icon: 'fail', content: error.response?.data?.error || '保存失败' });
      }
    }
  };

  const handleSubmitAudit = async () => {
    const result = await Dialog.confirm({
      content: '确认提交审核吗？提交后无法修改资料。',
    });
    if (result) {
      try {
        await submitAudit(id);
        Toast.show({ icon: 'success', content: '提交成功' });
        fetchData(); // Refresh status
      } catch (error) {
        Toast.show({ icon: 'fail', content: error.response?.data?.error || '提交失败' });
      }
    }
  };

  if (loading && !order) return <div>加载中...</div>;
  if (!order) return <div>订单不存在</div>;

  const configs = getMaterialTypes(order.plate_type);
  const is3C = order.plate_type === 'digital_3c';

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 40 }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>
        资料上传
      </NavBar>
      
      <div style={{ padding: 12 }}>
        <Card title="订单信息" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <div>订单号: {order.mchnt_ord_no || order.crm_order_no}</div>
            <div>客户: {order.customer_name}</div>
            <div>商品: {order.product_name}</div>
            <div>状态: <Tag color='primary'>{order.status}</Tag></div>
          </div>
        </Card>

        <Card title="设备信息" style={{ marginBottom: 12 }}>
          <Form layout='horizontal' footer={
            <Button size='small' color='primary' onClick={handleSaveInfo}>保存信息</Button>
          }>
            <Form.Item label="SN码">
              <Input 
                placeholder="请输入SN码" 
                value={snCode} 
                onChange={val => setSnCode(val)} 
                onBlur={handleSaveInfo}
              />
            </Form.Item>
            {is3C && (
              <>
                <Form.Item label="IMEI 1">
                  <Input 
                    placeholder="请输入IMEI 1" 
                    value={imei1} 
                    onChange={val => setImei1(val)}
                    onBlur={handleSaveInfo}
                  />
                </Form.Item>
                <Form.Item label="IMEI 2">
                  <Input 
                    placeholder="请输入IMEI 2" 
                    value={imei2} 
                    onChange={val => setImei2(val)}
                    onBlur={handleSaveInfo}
                  />
                </Form.Item>
              </>
            )}
          </Form>
        </Card>

        {configs.map(config => {
          const currentFiles = materials
            .filter(m => m.material_type === config.key)
            .map(m => ({
              url: m.file_url.replace('localhost', window.location.hostname),
              key: m.id
            }));

          return (
            <Card title={config.label} key={config.key} style={{ marginBottom: 12 }}>
              {/* Native File Input as fallback */}
              <div style={{ marginBottom: 10 }}>
                <input 
                  type="file" 
                  accept="image/*"
                  id={`file-input-${config.key}`}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleUpload(file, config.key);
                      // Clear input so same file can be selected again
                      e.target.value = null;
                    }
                  }}
                />
                <Button 
                  color="primary" 
                  fill="outline" 
                  size="small"
                  onClick={() => document.getElementById(`file-input-${config.key}`).click()}
                >
                  点击拍摄/上传图片
                </Button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {currentFiles.map((file, idx) => (
                  <div key={file.key} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img 
                      src={file.url} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
                      onClick={() => {
                        setCurrentImage(file.url);
                        setViewerVisible(true);
                      }}
                    />
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: '0 4px 0 4px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const material = materials.find(m => m.id === file.key);
                        if (material) handleDelete(material);
                      }}
                    >
                      ×
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}

        <Button 
          block 
          color='primary' 
          size='large' 
          onClick={handleSubmitAudit}
          disabled={order.status === 'audit_pending' || order.status === 'completed'}
        >
          提交审核
        </Button>
      </div>
      
      <ImageViewer
        image={currentImage}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </div>
  );
};

export default UploadPage;
