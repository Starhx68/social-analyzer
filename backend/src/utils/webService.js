const axios = require('axios');
const xml2js = require('xml2js');
const iconv = require('iconv-lite');
const logger = require('../config/logger');

// WebService 配置 (后续可移至环境变量)
const WEBSERVICE_URL = process.env.WEBSERVICE_URL || 'http://10.10.33.11/HDEP/ProcessWeb';

/**
 * WebService 调用工具类
 */
class WebServiceUtils {
  
  /**
   * 构建通用的 XML 请求头
   * @param {string} action 
   * @param {Object} parameters 
   * @param {Object} dataList 
   * @param {Object} additionXml 
   */
  static buildXml(action, parameters = {}, dataList = {}, additionXml = {}) {
    const builder = new xml2js.Builder({
      rootName: 'Program',
      xmldec: { version: '1.0', encoding: 'GB2312' },
      renderOpts: { pretty: true, indent: '    ', newline: '\n' }
    });

    const obj = {
      appid: '999',
      FunctionID: 'HG800025',
      Action: action,
      parameters: parameters,
      ...(Object.keys(dataList).length > 0 ? { data_list: dataList } : {}),
      addition_xml: {
        row1: {
          add1: process.env.WEBSERVICE_AUTH_USER || 'APPUser',
          add2: process.env.WEBSERVICE_AUTH_PWD || '107898',
          add3: process.env.WEBSERVICE_AUTH_IP || '10.10.1.999',
          add4: process.env.WEBSERVICE_AUTH_TOKEN || '1A682300CCE8D608ABProd',
          ...additionXml
        }
      }
    };

    // xml2js 生成的标签名默认为 camelCase，需要调整为 XML 中的 specific case
    // 由于 xml2js builder 不易处理复杂的命名转换，这里直接构造对象
    // 如果需要严格控制标签名，可能需要手动调整 obj 的 key
    
    // 修正 addition_xml 为 addition-xml
    const xml = builder.buildObject(obj).replace('addition_xml', 'addition-xml').replace('addition_xml', 'addition-xml');
    
    // 转换为 GB2312 编码的 Buffer
    return {
      string: xml,
      buffer: iconv.encode(xml, 'GB2312')
    };
  }

  /**
   * 发送 WebService 请求
   * @param {Buffer} xmlData 
   */
  static async sendRequest(xmlData) {
    try {
      const response = await axios.post(WEBSERVICE_URL, xmlData, {
        headers: {
          'Content-Type': 'application/xml; charset=GB2312'
        },
        responseType: 'arraybuffer' // 接收二进制数据以正确解码
      });

      // 解码响应
      // 优先尝试 UTF-8 解码，因为新接口可能返回 UTF-8
      let responseText = iconv.decode(response.data, 'utf8');
      
      // 简单检测：如果包含乱码特征（如 ），或者 XML 声明了 GB2312，则尝试 GB2312
      // 注意：iconv-lite 的 utf8 解码对于无效序列可能会替换为 
      if (responseText.includes('') || responseText.includes('encoding="GB2312"') || responseText.includes("encoding='GB2312'")) {
        // 如果 UTF-8 解码后看起来不对，尝试 GB2312
        // 但如果仅仅是因为 XML 声明了 GB2312 而实际内容是 UTF-8（如之前的乱码分析），则不应重试
        // 之前的乱码分析表明：服务器返回 UTF-8，但代码强行用 GB2312 解码导致乱码。
        // 所以这里应该优先信赖 UTF-8。
        // 为了保险，我们可以打印一下 content-type
        // logger.info('Response Content-Type:', response.headers['content-type']);
        
        // 如果 UTF-8 解码后 XML 声明仍然是 GB2312，说明 XML 内容本身可能是正确的 UTF-8，只是声明没改
        // 这种情况下 responseText 已经是正确的了。
        
        // 只有当 UTF-8 解码出乱码字符时，才回退到 GB2312
        if (responseText.includes('')) {
             const gbkText = iconv.decode(response.data, 'GB2312');
             // 简单的启发式：看谁的“”少，或者看谁能解析出 XML
             responseText = gbkText;
        }
      }
      
      // 强制修正：如果乱码分析确认为 UTF-8 被误读，则这里应该直接用 UTF-8。
      // 鉴于刚才的分析，服务器返回的很可能是 UTF-8。
      // 如果我们直接用 UTF-8 解码，应该能得到正确的中文字符串。
      responseText = iconv.decode(response.data, 'utf8');
      
      // 解析 XML 响应
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(responseText);
      
      return { raw: responseText, parsed: result };
    } catch (error) {
      logger.error('WebService Request Failed:', error);
      throw error;
    }
  }

  /**
   * 更新 SN 接口
   * @param {Object} params { crmOrderNo, sn, imei1, imei2 }
   */
  static async updateSn(params) {
    const { crmOrderNo, sn, imei1, imei2 } = params;
    
    const dataList = {
      row1: {
        vgbel: crmOrderNo,
        vbeln: '',
        sn: sn || '',
        imei1: imei1 || '',
        imei2: imei2 || '',
        zydid: '',
        addr: '',
        pic_list: '',
        rtn_msg: ''
      }
    };

    const { buffer, string } = this.buildXml('updateSubsidy', {}, dataList);
    const response = await this.sendRequest(buffer);
    return { ...response, requestXml: string };
  }

  /**
   * 获取发票接口
   * @param {string} crmOrderNo 
   */
  static async getInvoice(crmOrderNo) {
    const parameters = {
      order_no: crmOrderNo
    };

    const { buffer, string } = this.buildXml('getInvoice', parameters);
    const response = await this.sendRequest(buffer);
    return { ...response, requestXml: string };
  }

  /**
   * 根据手机号查询订单
   * @param {string} mobile
   */
  static async queryOrder(mobile) {
    const parameters = {
      mobile: mobile
    };

    const { buffer, string } = this.buildXml('queryOrder', parameters);
    const response = await this.sendRequest(buffer);
    return { ...response, requestXml: string };
  }
}

module.exports = WebServiceUtils;
