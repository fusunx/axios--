import axios from 'axios'
import { Indicator, Toast } from 'mint-ui'
import router from '../router'
import store from '../store'
import statistics from '../assets/js/burial-point-statistics'

var HOST = process.env.HOST
var total = 0 // 正在请求的数量

// 配置API接口地址
// var root = '/static/json'
var root = store.state.baseUrl + '/parenting'
if (HOST === 'dev') { // 本地测试环境
  root = '/parenting/'
}
var blLoading = true // 是否显示loading及报错信息
var blInit = false // 数据埋点是否初始化完成
// 引用axios
// 自定义判断元素类型JS
function toType (obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}
// 参数过滤函数
function filterNull (o) {
  for (var key in o) {
    if (o[key] === null) {
      delete o[key]
    } else if (toType(o[key]) === 'string') {
      o[key] = o[key].trim()
    } else if (toType(o[key]) === 'object') {
      o[key] = filterNull(o[key])
    } else if (toType(o[key]) === 'array') {
      o[key] = filterNull(o[key])
    }
  }
  return o
}
// 获取cookie中的str值
function getCookie (str) {
  if (HOST === 'dev') { // 本地测试环境
    if (str === 'mc_token') { // 微课token
      return '082d796b51884b50989447d8246fdfc0'
    } else if (str === 'mm_token') { // 疫苗学堂token
      return '2bf2e63891c44b8ab8b45e8d56817fab'
    } else {
      return ''
    }
  }
  let cookieArr = document.cookie.split(';')
  for (let i = 0; i < cookieArr.length; i++) {
    let arr = cookieArr[i].split('=')
    if (trim(arr[0]) === str) {
      return trim(arr[1])
    }
  }
  return ''
}

// 去掉cookie key及value的前后空格
function trim (str) {
  return str.replace(/(^\s*)|(\s*$)/g, '')
}

/*
  接口处理函数
  这个函数每个项目都是不一样的，我现在调整的是适用于
  https://cnodejs.org/api/v1 的接口，如果是其他接口
  需要根据接口的参数进行调整。参考说明文档地址：
  https://cnodejs.org/topic/5378720ed6e2d16149fa16bd
  主要是，不同的接口的成功标识和失败提示是不一致的。
  另外，不同的项目的处理方法也是不一致的，这里出错就是简单的alert
*/

// axios允许携带cookie
axios.defaults.withCredentials = true
// 配置axios,读取数据时候和返回数据时，可以自定义一段代码(loading显示隐藏)
axios.interceptors.request.use(function (config) {
  // 显示loading
  total++
  if (blLoading) {
    Indicator.open()
  }
  return config
}, function (error) {
  return Promise.reject(error)
})
axios.interceptors.response.use(function (response) {
  // 隐藏loading
  total--
  if (total === 0) {
    Indicator.close()
  }
  return response
}, function (err) {
  // 隐藏loading
  total--
  if (total === 0) {
    Indicator.close()
  }
  if (err && err.response) {
    switch (err.response.status) {
      case 400: err.message = '请求错误(400)'; break
      case 401: err.message = '未授权，请重新登录(401)'; break
      case 403: err.message = '拒绝访问(403)'; break
      case 404: err.message = '请求出错(404)'; break
      case 408: err.message = '请求超时(408)'; break
      case 500: err.message = '服务器错误(500)'; break
      case 501: err.message = '服务未实现(501)'; break
      case 502: err.message = '网络错误(502)'; break
      case 503: err.message = '服务不可用(503)'; break
      case 504: err.message = '网络超时(504)'; break
      case 505: err.message = 'HTTP版本不受支持(505)'; break
      default: err.message = `连接出错(${err.response.status})!`
    }
  } else {
    err.message = '连接服务器失败!'
  }
  return Promise.reject(err)
})

function apiAxios (method, url, params, success, failure, blLoading) {
  if (params) {
    params = filterNull(params)
  }
  let appType = 1
  axios({
    method: method,
    url: url,
    data: method === 'POST' || method === 'PUT' ? params : null,
    params: method === 'GET' || method === 'DELETE' ? params : null,
    baseURL: root,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'token': appType === 1 ? getCookie('mc_token') : getCookie('mm_token'), // 用户cookie
      'qz-platform': 2, // 平台类型
      'app-type': appType, // 访问来源（app/H5）
      'scene': sessionStorage.getItem('scene') || '' // 渠道来源
    },
    dataType: 'json',
    withCredentials: false,
    timeout: 120000 // 超时设置
  }).then((res) => {
    if (res.status === 200) {
      if ((res.data.code === '11200000000' || res.data.code === '11100000000') && (blLoading || url === '/wechat/config/jsConfig')) { // 用户未登录或登录已失效,去授权
        try {
          let arr = window.location.href.split(HOST)
          let arr2 = arr[1].split('?')[1] ? arr[1].split('?')[1].split('&') : []
          arr2.unshift(arr[1].split('?')[0])
          let dev = HOST.indexOf('/dev/') !== -1 ? 'dev/' : ''
          let path = 'mc/' + dev + arr2.toString(',') // 后台授权完重定向地址
          window.location.href = store.state.baseUrl + '/parenting/wechat/auth/redirect/2/' + appType + '?path=' + path
        } catch (e) {
          Toast('授权失败~')
        }
      } else {
        if (!blInit) {
          blInit = true
          statistics.login(getCookie('mc_uid')) // 亲子课堂登录事件
        }
        if (res.data.code === '00000' || res.data.code === '70100150000') {
          success && success(res.data)
        } else {
          if (blLoading) {
            Toast(res.data.errorMsg)
          }
        }
      }
    } else {
      if (failure) {
        failure(res.data)
      } else {
        if (blLoading) {
          Toast('error: ' + JSON.stringify(res.data))
        }
      }
    }
  }).catch((err) => {
    if (err && blLoading) { // 请求异常跳转异常页
      if (err.code === 'ECONNABORTED' && err.message.indexOf('timeout') !== -1) {
        router.push('/request-error?state=2')
      } else {
        router.push('/request-error?state=1')
      }
    } else {
      if (blLoading) {
        router.push('/request-error?state=2')
      }
    }
  })
}

// 返回在vue模板中的调用接口
export default {
  get (url, params, success, failure, bl) {
    blLoading = !(bl || false)
    return apiAxios('POST', url, params, success, failure, blLoading)
  },
  post (url, params, success, failure, bl) {
    blLoading = !(bl || false)
    return apiAxios('POST', url, params, success, failure, blLoading)
  },
  put (url, params, success, failure, bl) {
    blLoading = !(bl || false)
    return apiAxios('POST', url, params, success, failure, blLoading)
  },
  delete (url, params, success, failure, bl) {
    blLoading = !(bl || false)
    return apiAxios('POST', url, params, success, failure, blLoading)
  }
}
