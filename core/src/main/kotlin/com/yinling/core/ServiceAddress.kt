package com.yinling.core

import java.net.URI

object ServiceAddress {
    fun error(value: String): String? {
        val address = value.trim()
        if (address.isBlank()) return "请填写服务地址"
        val uri = runCatching { URI(address) }.getOrNull() ?: return "服务地址格式不正确"
        val host = uri.host?.lowercase() ?: return "请填写包含完整域名的服务地址"
        val scheme = uri.scheme?.lowercase()
        if (scheme != "https" && !(scheme == "http" && host in setOf("127.0.0.1", "localhost"))) {
            return "服务地址必须使用 HTTPS；本机联调可使用 HTTP 回环地址"
        }
        if (uri.rawUserInfo != null) return "不要在地址中填写账号或密钥"
        if (uri.rawQuery != null || uri.rawFragment != null) return "服务地址不能包含查询参数或页面锚点"
        if (uri.port != -1 && uri.port !in 1..65535) return "服务端口必须在 1 到 65535 之间"
        return null
    }
}
