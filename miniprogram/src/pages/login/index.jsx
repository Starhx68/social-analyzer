import React, { useState } from 'react'
import { View } from '@tarojs/components'
import { AtButton, AtInput, AtForm, AtMessage } from 'taro-ui'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    if (!username || !password) {
      Taro.atMessage({
        'message': '请输入用户名和密码',
        'type': 'error',
      })
      return
    }

    try {
      // 模拟登录请求
      // const res = await Taro.request({ url: '/api/auth/login', ... })
      
      // 模拟成功
      Taro.setStorageSync('token', 'mock-token')
      Taro.setStorageSync('user', { username, role: 'user' })
      
      Taro.switchTab({
        url: '/pages/index/index'
      })
    } catch (error) {
      Taro.atMessage({
        'message': '登录失败',
        'type': 'error',
      })
    }
  }

  return (
    <View className='login-page'>
      <AtMessage />
      <View className='title'>国补订单资料上传</View>
      <AtForm>
        <AtInput
          name='username'
          title='用户名'
          type='text'
          placeholder='请输入用户名'
          value={username}
          onChange={setUsername}
        />
        <AtInput
          name='password'
          title='密码'
          type='password'
          placeholder='请输入密码'
          value={password}
          onChange={setPassword}
        />
        <View className='btn-group'>
          <AtButton type='primary' onClick={handleLogin}>登录</AtButton>
        </View>
      </AtForm>
    </View>
  )
}
