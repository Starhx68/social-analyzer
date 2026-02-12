const iconv = require('iconv-lite');

const str = '韬浠介獙璇佸嚭鐜板紓甯: 鏃犳晥鐨勪护鐗';
// 尝试逆向工程：假设这是 GBK 被当成 UTF-8 读出来的，或者反之。
// 通常这种乱码是：原始字节流是 UTF-8，被当成 GBK 读？不对。
// 原始是 GBK，被当成 UTF-8 展示？
// "身份验证出现异常" (GBK) -> bytes -> (UTF-8 decode) -> 乱码

const target = '身份验证出现异常: 无效的令牌';
const gbkBuffer = iconv.encode(target, 'GB2312');
const utf8Str = gbkBuffer.toString('utf8');

console.log('Target (GBK bytes as UTF8):', utf8Str);
console.log('Match?', utf8Str === str || utf8Str.includes('韬'));
