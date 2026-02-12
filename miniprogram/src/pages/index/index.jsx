import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Index() {
  const [orders, setOrders] = useState([])

  useEffect(() => {
    console.log('Index page mounted')
    // 模拟数据
    setOrders([
      { id: '1', mchnt_ord_no: 'ORD20240119001', product_name: '格力空调', status: 'pending', amount: 3999 },
      { id: '2', mchnt_ord_no: 'ORD20240119002', product_name: '小米电视', status: 'auditing', amount: 2999 },
    ])
  }, [])

  const gotoDetail = (id) => {
    console.log('gotoDetail:', id)
    Taro.showToast({
      title: '点击订单: ' + id,
      icon: 'none'
    })
  }

  return (
    <View className='index-page'>
      <View className='header'>
        <Text className='title'>国补订单资料上传</Text>
      </View>

      <View className='order-list'>
        {orders.map(order => (
          <View key={order.id} className='order-item' onClick={() => gotoDetail(order.id)}>
            <View className='order-name'>{order.product_name}</View>
            <View className='order-no'>订单号: {order.mchnt_ord_no}</View>
            <View className='order-footer'>
              <Text className='order-amount'>¥{order.amount}</Text>
              <Text className='order-status'>
                {order.status === 'pending' ? '待上传' : '审核中'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
