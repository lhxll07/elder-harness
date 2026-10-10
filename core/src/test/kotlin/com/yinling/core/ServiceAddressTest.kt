package com.yinling.core

import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ServiceAddressTest {
    @Test
    fun `https addresses support provider paths and surrounding whitespace`() {
        listOf("https://example.com", " https://example.com/v1/ ", "https://example.com:8443/api").forEach { address ->
            assertNull(ServiceAddress.error(address), address)
        }
    }

    @Test
    fun `http is limited to the Android network policy loopback hosts`() {
        listOf("http://127.0.0.1:8787", "http://localhost:8787").forEach { address ->
            assertNull(ServiceAddress.error(address), address)
        }
        listOf("http://example.com", "http://192.168.1.2:8787", "http://127.0.0.1.evil.test", "http://[::1]:8787").forEach { address ->
            assertNotNull(ServiceAddress.error(address), address)
        }
    }

    @Test
    fun `empty malformed and non web addresses are rejected`() {
        listOf("", " ", "example.com", "https://", "https://exa mple.com", "file:///tmp/server").forEach { address ->
            assertNotNull(ServiceAddress.error(address), address)
        }
    }

    @Test
    fun `credentials queries and fragments cannot be hidden in the base address`() {
        listOf("https://user:secret@example.com", "https://example.com?token=secret", "https://example.com#setup").forEach { address ->
            assertNotNull(ServiceAddress.error(address), address)
        }
    }

    @Test
    fun `invalid ports are rejected`() {
        listOf("https://example.com:0", "https://example.com:65536", "https://example.com:port").forEach { address ->
            assertNotNull(ServiceAddress.error(address), address)
        }
    }
}
