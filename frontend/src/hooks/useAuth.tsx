'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import api from '@/lib/api'

export interface User {
  id: number
  username: string
  email: string
  display_name: string | null
  avatar_url: string | null
  is_root: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (usernameOrEmail: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: any) => Promise<void>
  checkUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PUBLIC_ROUTES = ['/', '/login', '/register']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const checkUser = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (err) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkUser()
  }, [])

  // Guard routing
  useEffect(() => {
    if (!loading) {
      const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname === '/blog' || pathname?.startsWith('/blog/')
      if (!user && !isPublic) {
        router.push('/login')
      }
    }
  }, [user, loading, pathname, router])

  const login = async (usernameOrEmail: string, password: string) => {
    setLoading(true)
    try {
      await api.post('/auth/login', {
        username_or_email: usernameOrEmail,
        password,
      })
      // Fetch user info after successful login
      const meResponse = await api.get('/auth/me')
      setUser(meResponse.data)
      setLoading(false)
      router.push('/dashboard')
    } catch (err: any) {
      setUser(null)
      setLoading(false)
      throw new Error(err.response?.data?.detail || '登录失败，请检查用户名或密码。')
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await api.post('/auth/logout')
    } catch (err) {
      // Ignore API logout error
    } finally {
      setUser(null)
      setLoading(false)
      router.push('/login')
    }
  }

  const register = async (data: any) => {
    setLoading(true)
    try {
      await api.post('/auth/register', data)
      // Auto login after successful registration
      await login(data.username, data.password)
    } catch (err: any) {
      setLoading(false)
      throw new Error(err.response?.data?.detail || '注册失败，请检查输入项。')
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, checkUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
