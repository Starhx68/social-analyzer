
const orderSyncService = require('../src/services/orderSyncService');

const mockData = {
  ORDER_GB: "HM30",
  GOODS_ATTRIBUTE: "{\"nx\":\"\",\"nxbm\":\"\",\"pl\":\"家纺类产品\",\"plbm\":\"G_0601\",\"txm\":\"397338\",\"xh\":\"\",\"yhm\":\"HUNJF\",\"pp\":\"VIPLIFE\",\"xm\":\"jz\"}",
  CATEGORY_NAME: null
};

console.log('Testing parseOracleData with mock data...');
const parsed = orderSyncService.parseOracleData(mockData);

console.log('Parsed plate_type:', parsed.plate_type);
console.log('Parsed product_category:', parsed.product_category);

// Check getPlateTypeFromAttr directly
console.log('getPlateTypeFromAttr result:', orderSyncService.getPlateTypeFromAttr(mockData));

// Check mapPlateType directly
console.log('mapPlateType result:', orderSyncService.mapPlateType(mockData.ORDER_GB));
