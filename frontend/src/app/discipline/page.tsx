'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Heart, ArrowLeft, Loader2, Calendar, Scale, Footprints, Flame,
  Apple, Dumbbell, UploadCloud, ChevronLeft, ChevronRight, Plus, Sparkles, Check, AlertCircle, Edit3
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/layout/ThemeToggle'
import Button from '@/components/ui/Button'

interface HealthProfile {
  height: number
  initial_weight: number
  target_weight: number | null
  bmi: number
  created_at: string
  updated_at: string
}

interface DailyLog {
  id: number
  log_date: string
  weight: number | null
  step_count: number | null
  active_energy: number | null
  diet_text: string | null
  diet_image_url: string | null
  fitness_text: string | null
  fitness_image_url: string | null
  intake_calories: number
  burned_calories: number
  calorie_gap: number
  ai_analysis: string | null
  created_at: string
  updated_at: string
}

export default function DisciplinePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Guard Route
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else if (!user.is_root && !user.is_discipline_authorized) {
        router.push('/dashboard')
      }
    }
  }, [user, authLoading, router])

  // Profile & Logs State
  const [profile, setProfile] = useState<HealthProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // Profile Setup State
  const [profileHeight, setProfileHeight] = useState('170')
  const [profileWeight, setProfileWeight] = useState('65')
  const [profileTargetWeight, setProfileTargetWeight] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Log Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDateStr, setSelectedDateStr] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editSteps, setEditSteps] = useState('')
  const [editActiveEnergy, setEditActiveEnergy] = useState('')
  const [editDietText, setEditDietText] = useState('')
  const [editDietImageUrl, setEditDietImageUrl] = useState('')
  const [editFitnessText, setEditFitnessText] = useState('')
  const [editFitnessImageUrl, setEditFitnessImageUrl] = useState('')
  const [editIntakeCalories, setEditIntakeCalories] = useState('')
  const [editBurnedCalories, setEditBurnedCalories] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')

  // Loading States for Upload / AI
  const [uploadingDietImg, setUploadingDietImg] = useState(false)
  const [uploadingFitnessImg, setUploadingFitnessImg] = useState(false)
  const [analyzingDiet, setAnalyzingDiet] = useState(false)
  const [analyzingFitness, setAnalyzingFitness] = useState(false)
  const [savingLog, setSavingLog] = useState(false)

  // Health Data Import State
  const [isDragging, setIsDragging] = useState(false)
  const [importingFile, setImportingFile] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch functions
  const fetchProfile = async () => {
    try {
      const res = await api.get('/discipline/profile')
      setProfile(res.data)
      if (res.data) {
        setProfileHeight(String(res.data.height))
        setProfileWeight(String(res.data.initial_weight))
        setProfileTargetWeight(res.data.target_weight ? String(res.data.target_weight) : '')
      }
    } catch (err) {
      console.error('获取健康档案失败', err)
    } finally {
      setLoadingProfile(false)
    }
  }

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await api.get('/discipline/logs', {
        params: { year, month }
      })
      setLogs(res.data)
    } catch (err) {
      console.error('获取健康打卡数据失败', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (user && (user.is_root || user.is_discipline_authorized)) {
      fetchProfile()
    }
  }, [user])

  useEffect(() => {
    if (user && (user.is_root || user.is_discipline_authorized) && profile) {
      fetchLogs()
    }
  }, [user, currentDate, profile])

  // Profile Action handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await api.post('/discipline/profile', {
        height: parseFloat(profileHeight),
        initial_weight: parseFloat(profileWeight),
        target_weight: profileTargetWeight ? parseFloat(profileTargetWeight) : null
      })
      setProfile(res.data)
      showToast('success', '健康档案设置成功！')
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '保存失败，请检查输入参数。')
    } finally {
      setSavingProfile(false)
    }
  }

  // Upload Photo to Lsky
  const handleImageUpload = async (file: File, type: 'diet' | 'fitness') => {
    const formData = new FormData()
    formData.append('file', file)
    
    if (type === 'diet') setUploadingDietImg(true)
    else setUploadingFitnessImg(true)

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data && res.data.url) {
        if (type === 'diet') {
          setEditDietImageUrl(res.data.url)
        } else {
          setEditFitnessImageUrl(res.data.url)
        }
        showToast('success', '图片上传成功！')
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '图片上传失败，请检查图床配置。')
    } finally {
      setUploadingDietImg(false)
      setUploadingFitnessImg(false)
    }
  }

  // AI Calorie Estimation
  const handleAIDietEstimate = async () => {
    if (!editDietText && !editDietImageUrl) {
      showToast('error', '请先填写食物描述或上传食物照片，再触发 AI 评估。')
      return
    }
    setAnalyzingDiet(true)
    try {
      const res = await api.post('/discipline/analyze-diet', {
        image_url: editDietImageUrl || null,
        text: editDietText || null
      })
      setEditIntakeCalories(String(res.data.calories))
      setAiAnalysis((prev) => {
        const itemStr = `【饮食评估】${res.data.analysis}`
        return prev ? `${prev}\n\n${itemStr}` : itemStr
      })
      showToast('success', 'AI 饮食卡路里评估完成！')
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'AI 评估请求失败，请检查默认 AI 配置。')
    } finally {
      setAnalyzingDiet(false)
    }
  }

  const handleAIFitnessEstimate = async () => {
    if (!editFitnessText && !editFitnessImageUrl) {
      showToast('error', '请先输入运动内容或上传运动数据截图，再触发 AI 评估。')
      return
    }
    setAnalyzingFitness(true)
    try {
      const res = await api.post('/discipline/analyze-fitness', {
        image_url: editFitnessImageUrl || null,
        text: editFitnessText || null
      })
      setEditActiveEnergy(String(res.data.calories))
      setAiAnalysis((prev) => {
        const itemStr = `【运动评估】${res.data.analysis}`
        return prev ? `${prev}\n\n${itemStr}` : itemStr
      })
      showToast('success', 'AI 健身消耗卡路里评估完成！')
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'AI 评估请求失败，请检查默认 AI 配置。')
    } finally {
      setAnalyzingFitness(false)
    }
  }

  // Import Apple Health Zip/Xml
  const handleAppleHealthUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    setImportingFile(true)
    setImportResult(null)

    try {
      const res = await api.post('/discipline/import-apple-health', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImportResult({ success: true, message: res.data.message })
      showToast('success', '苹果健康数据同步成功！')
      fetchLogs()
    } catch (err: any) {
      setImportResult({ success: false, message: err.response?.data?.detail || '解析上传文件失败。' })
      showToast('error', '同步苹果健康数据失败。')
    } finally {
      setImportingFile(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      if (ext === '.zip' || ext === '.xml') {
        handleAppleHealthUpload(file)
      } else {
        showToast('error', '仅支持上传苹果健康导出的 .zip 压缩包或 .xml 文件。')
      }
    }
  }

  // Calendar calculation
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).getDay()

  const daysCount = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfMonth(year, month)

  const calendarDays: { dateStr: string; dayNum: number; currentMonth: boolean }[] = []
  
  // Previous month days to fill start
  const prevMonthDays = getDaysInMonth(year, month - 1 === 0 ? 12 : month - 1)
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const mStr = String(month - 1 === 0 ? 12 : month - 1).padStart(2, '0')
    const yStr = String(month - 1 === 0 ? year - 1 : year)
    calendarDays.push({
      dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      currentMonth: false
    })
  }

  // Current month days
  for (let d = 1; d <= daysCount; d++) {
    calendarDays.push({
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      currentMonth: true
    })
  }

  // Next month days to fill end
  const totalSlotsNeeded = 42 // 6 rows of 7 days
  const remainingSlots = totalSlotsNeeded - calendarDays.length
  for (let d = 1; d <= remainingSlots; d++) {
    const mStr = String(month + 1 === 13 ? 1 : month + 1).padStart(2, '0')
    const yStr = String(month + 1 === 13 ? year + 1 : year)
    calendarDays.push({
      dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      currentMonth: false
    })
  }

  // Navigate month
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  // Open Log modal for specific day
  const handleOpenDayModal = (dateStr: string) => {
    const existingLog = logs.find(l => l.log_date === dateStr)
    setSelectedDateStr(dateStr)
    setEditWeight(existingLog?.weight ? String(existingLog.weight) : '')
    setEditSteps(existingLog?.step_count ? String(existingLog.step_count) : '')
    setEditActiveEnergy(existingLog?.active_energy ? String(existingLog.active_energy) : '')
    setEditDietText(existingLog?.diet_text || '')
    setEditDietImageUrl(existingLog?.diet_image_url || '')
    setEditFitnessText(existingLog?.fitness_text || '')
    setEditFitnessImageUrl(existingLog?.fitness_image_url || '')
    setEditIntakeCalories(existingLog?.intake_calories ? String(existingLog.intake_calories) : '')
    setEditBurnedCalories(existingLog?.burned_calories ? String(existingLog.burned_calories) : '')
    setAiAnalysis(existingLog?.ai_analysis || '')
    setIsModalOpen(true)
  }

  // Save specific day's punch log
  const handleSaveDailyLog = async () => {
    setSavingLog(true)
    try {
      const data = {
        log_date: selectedDateStr,
        weight: editWeight ? parseFloat(editWeight) : null,
        step_count: editSteps ? parseInt(editSteps) : null,
        active_energy: editActiveEnergy ? parseFloat(editActiveEnergy) : null,
        diet_text: editDietText || null,
        diet_image_url: editDietImageUrl || null,
        fitness_text: editFitnessText || null,
        fitness_image_url: editFitnessImageUrl || null,
        intake_calories: editIntakeCalories ? parseInt(editIntakeCalories) : null,
        burned_calories: editBurnedCalories ? parseInt(editBurnedCalories) : null,
      }
      const res = await api.post('/discipline/log', data)
      showToast('success', `${selectedDateStr} 自律打卡保存成功！`)
      
      // Update local logs list
      setLogs((prev) => {
        const otherLogs = prev.filter(l => l.log_date !== selectedDateStr)
        return [...otherLogs, res.data].sort((a, b) => a.log_date.localeCompare(b.log_date))
      })
      setIsModalOpen(false)
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '保存自律打卡日志出错。')
    } finally {
      setSavingLog(false)
    }
  }

  // Helper values for current status
  const todayStr = new Date().toISOString().split('T')[0]
  const todayLog = logs.find(l => l.log_date === todayStr)

  // Current weight estimation
  const currentWeight = todayLog?.weight || profile?.initial_weight || 65.0
  const currentBMR = profile ? (10.0 * currentWeight + 6.25 * profile.height - 5 * 25 + 5) : 1500
  const activeCalories = todayLog?.active_energy || 0.0
  const totalTodayBurned = todayLog?.burned_calories || Math.round(currentBMR + activeCalories)
  const totalTodayIntake = todayLog?.intake_calories || 0
  const todayDeficit = totalTodayBurned - totalTodayIntake

  // BMI Interpretation
  const bmiVal = profile ? (todayLog?.weight ? Number((todayLog.weight / Math.pow(profile.height / 100, 2)).toFixed(1)) : profile.bmi) : 22.0
  const getBmiStatus = (bmi: number) => {
    if (bmi < 18.5) return { text: '体重偏瘦', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' }
    if (bmi >= 18.5 && bmi < 24) return { text: '体重正常', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' }
    if (bmi >= 24 && bmi < 28) return { text: '体重超重', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' }
    return { text: '轻重度肥胖', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' }
  }
  const bmiStatus = getBmiStatus(bmiVal)

  // Calculate indicator rotation angle for BMI gauge (-90deg to +90deg based on BMI 15 to 33)
  const getBmiRotation = (bmi: number) => {
    const minBmi = 15
    const maxBmi = 33
    const percentage = Math.max(0, Math.min(100, ((bmi - minBmi) / (maxBmi - minBmi)) * 100))
    return -90 + (percentage / 100) * 180
  }

  // Circular progress strokeDashoffset logic
  const radius = 64
  const strokeWidth = 12
  const circ = 2 * Math.PI * radius
  const deficitPercentage = Math.max(0, Math.min(100, totalTodayBurned > 0 ? (todayDeficit / totalTodayBurned) * 100 : 0))
  const strokeDashoffset = circ - (deficitPercentage / 100) * circ

  // Prepare chart data for last 30 days
  const last30Days = [...Array(30)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })

  // Filter logs of the last 30 days
  const activeLogDict = logs.reduce((acc, log) => {
    acc[log.log_date] = log
    return acc
  }, {} as Record<string, DailyLog>)

  const chartData = last30Days.map(dateStr => {
    const l = activeLogDict[dateStr]
    return {
      date: dateStr.split('-')[2], // Day number string
      fullName: dateStr,
      weight: l?.weight || null,
      intake: l ? l.intake_calories : 0,
      burned: l ? l.burned_calories : 0
    }
  })

  // Render SVG Weight Line Chart
  const renderWeightChart = () => {
    const weightsWithIndex = chartData
      .map((d, index) => ({ val: d.weight, index }))
      .filter((w): w is { val: number; index: number } => w.val !== null)

    if (weightsWithIndex.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-sm text-onSurface/40 dark:text-foreground/45">
          近30天暂无体重打卡数据，添加打卡或导入苹果健康后即刻生成趋势。
        </div>
      )
    }

    const minW = Math.min(...weightsWithIndex.map(w => w.val)) - 1.5
    const maxW = Math.max(...weightsWithIndex.map(w => w.val)) + 1.5
    const range = maxW - minW || 1

    const width = 680
    const height = 240
    const padding = 36

    // Map coordinates
    const points = weightsWithIndex.map(w => {
      const x = padding + (w.index / 29) * (width - 2 * padding)
      const y = height - padding - ((w.val - minW) / range) * (height - 2 * padding)
      return { x, y, val: w.val, date: chartData[w.index].fullName }
    })

    // Create line path
    let linePath = ''
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} `
      for (let i = 1; i < points.length; i++) {
        linePath += `L ${points[i].x} ${points[i].y} `
      }
    }

    // Create area path under the line
    let areaPath = ''
    if (points.length > 0) {
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    }

    return (
      <div className="w-full overflow-x-auto scrollbar-thin">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-auto overflow-visible select-none">
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8814A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#E8814A" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding + ratio * (height - 2 * padding)
            const val = maxW - ratio * range
            return (
              <g key={i}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-secondary dark:stroke-darkBorder" strokeDasharray="4" />
                <text x={padding - 6} y={y + 4} textAnchor="end" className="text-[10px] font-medium fill-onSurface/40 dark:fill-foreground/40 font-mono">
                  {val.toFixed(1)}kg
                </text>
              </g>
            )
          })}

          {/* Area under curve */}
          {areaPath && <path d={areaPath} fill="url(#weightGrad)" />}
          
          {/* Main Curve */}
          {linePath && <path d={linePath} fill="none" stroke="#E8814A" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-[0_2px_8px_rgba(232,129,74,0.3)]" />}
          
          {/* Points */}
          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <circle cx={p.x} cy={p.y} r="4" className="fill-white dark:fill-darkCard stroke-primary" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="8" className="fill-primary opacity-0 group-hover:opacity-20 transition-opacity" />
              <title>{`${p.date}\n体重: ${p.val} kg`}</title>
            </g>
          ))}

          {/* X axis dates labels */}
          {chartData.map((d, index) => {
            if (index % 5 === 0) {
              const x = padding + (index / 29) * (width - 2 * padding)
              return (
                <text key={index} x={x} y={height - 12} textAnchor="middle" className="text-[10px] font-medium fill-onSurface/45 dark:fill-foreground/45 font-mono">
                  {d.fullName.substring(5)}
                </text>
              )
            }
            return null
          })}
        </svg>
      </div>
    )
  }

  // Render SVG Calorie Bars
  const renderCalorieChart = () => {
    const hasData = chartData.some(d => d.intake > 0 || d.burned > 0)
    if (!hasData) {
      return (
        <div className="h-64 flex items-center justify-center text-sm text-onSurface/40 dark:text-foreground/45">
          近30天暂无饮食/运动记录，上传日志以展示摄入和消耗卡路里的双柱对比。
        </div>
      )
    }

    const maxCal = Math.max(...chartData.map(d => Math.max(d.intake, d.burned)), 2000)
    const yMax = Math.ceil(maxCal / 500) * 500

    const width = 680
    const height = 240
    const padding = 40

    const barWidth = 4.5
    const gap = 2

    return (
      <div className="w-full overflow-x-auto scrollbar-thin">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-auto overflow-visible select-none">
          {/* Grid y lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding + ratio * (height - 2 * padding)
            const val = yMax - ratio * yMax
            return (
              <g key={i}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-secondary dark:stroke-darkBorder" strokeDasharray="3" />
                <text x={padding - 6} y={y + 4} textAnchor="end" className="text-[10px] font-medium fill-onSurface/40 dark:fill-foreground/40 font-mono">
                  {val}
                </text>
              </g>
            )
          })}

          {/* Draw bars */}
          {chartData.map((d, index) => {
            const x = padding + (index / 29) * (width - 2 * padding)
            
            // Intake bar (Rose)
            const hIntake = (d.intake / yMax) * (height - 2 * padding)
            const yIntake = height - padding - hIntake

            // Burned bar (Emerald)
            const hBurned = (d.burned / yMax) * (height - 2 * padding)
            const yBurned = height - padding - hBurned

            return (
              <g key={index} className="group cursor-pointer">
                {/* Intake rect */}
                {d.intake > 0 && (
                  <rect
                    x={x - barWidth - gap}
                    y={yIntake}
                    width={barWidth}
                    height={hIntake}
                    rx="1.5"
                    className="fill-rose-500/80 hover:fill-rose-500 transition-all"
                  />
                )}
                {/* Burned rect */}
                {d.burned > 0 && (
                  <rect
                    x={x + gap}
                    y={yBurned}
                    width={barWidth}
                    height={hBurned}
                    rx="1.5"
                    className="fill-emerald-500/80 hover:fill-emerald-500 transition-all"
                  />
                )}
                <title>{`${d.fullName}\n摄入卡路里: ${d.intake} kcal\n总消耗卡路里: ${d.burned} kcal\n赤字缺口: ${d.burned - d.intake} kcal`}</title>
              </g>
            )
          })}

          {/* Dates labels */}
          {chartData.map((d, index) => {
            if (index % 5 === 0) {
              const x = padding + (index / 29) * (width - 2 * padding)
              return (
                <text key={index} x={x} y={height - 12} textAnchor="middle" className="text-[10px] font-medium fill-onSurface/45 dark:fill-foreground/45 font-mono">
                  {d.fullName.substring(5)}
                </text>
              )
            }
            return null
          })}
        </svg>
      </div>
    )
  }

  // Pre-render loaders
  if (authLoading || loadingProfile) {
    return (
      <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center text-primary font-medium">
        <Loader2 className="animate-spin mr-2 h-5 w-5" />
        加载自律记录模块中...
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300 relative overflow-hidden font-sans">
      {/* Background blurs */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-primary/5 dark:bg-primary/2 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/2 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" passHref>
              <button className="p-2 rounded-lg hover:bg-secondary dark:hover:bg-darkBorder transition-colors group">
                <ArrowLeft className="h-4 w-4 text-onSurface/60 dark:text-foreground/60 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </Link>
            <div className="flex items-center space-x-2">
              <span className="font-display text-xl font-bold tracking-wide text-primary">
                Lumino
              </span>
              <span className="text-xs bg-secondary text-primary px-2.5 py-0.5 rounded-full font-semibold dark:bg-secondary/10">
                自律记录打卡
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10 relative z-10">
        
        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3.5 rounded-xl shadow-lg border transition-all animate-slide-up bg-white dark:bg-darkCard ${
            toast.type === 'success' ? 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'border-red-500/20 text-red-500'
          }`}>
            {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        )}

        {/* 1. HEALTH PROFILE SETUP (IF EMPTY) */}
        {!profile ? (
          <section className="max-w-xl mx-auto p-8 rounded-3xl backdrop-blur-xl bg-white/50 dark:bg-darkCard/50 border border-secondary dark:border-darkBorder shadow-lg space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <Heart className="h-10 w-10 text-primary mx-auto animate-pulse" />
              <h2 className="text-2xl font-bold text-onSurface dark:text-foreground">建立您的健康档案</h2>
              <p className="text-sm text-onSurface/60 dark:text-foreground/60">
                为了更精准地核算您的 BMI 指数与每日基础代谢率（BMR），请先配置您的身体基础数据。
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">身高 (cm) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="例如：175.5"
                  value={profileHeight}
                  onChange={(e) => setProfileHeight(e.target.value)}
                  className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">初始体重 (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="例如：68.2"
                  value={profileWeight}
                  onChange={(e) => setProfileWeight(e.target.value)}
                  className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">目标体重 (kg, 选填)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="例如：62.0"
                  value={profileTargetWeight}
                  onChange={(e) => setProfileTargetWeight(e.target.value)}
                  className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <Button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-primary text-white hover:bg-primary-hover shadow-sm font-semibold rounded-xl"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    正在初始化档案...
                  </>
                ) : (
                  '保存并开启健康打卡'
                )}
              </Button>
            </form>
          </section>
        ) : (
          <>
            {/* 2. OVERVIEW: BMI GAUGE & CALORIE DEFICIT RING */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* BMI Gauge Panel (Col 5) */}
              <div className="lg:col-span-5 p-8 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-darkCard/40 border border-secondary dark:border-darkBorder shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center space-x-2">
                    <Scale className="h-5 w-5 text-primary" />
                    <span>身体质量指数 (BMI)</span>
                  </h3>
                  <p className="text-xs text-onSurface/50 dark:text-foreground/50 mt-1">根据最新打卡体重估算当前的健康水平。</p>
                </div>

                {/* Gauge Animation Visual */}
                <div className="relative w-full max-w-[240px] mx-auto mt-6 aspect-[2/1] overflow-hidden flex items-end justify-center">
                  {/* Color Arc Track */}
                  <div className="absolute bottom-0 w-full h-[200%] rounded-full border-[20px] border-b-transparent border-l-transparent border-r-transparent border-t-transparent rotate-45" />
                  
                  {/* Gauge Arc Background SVG */}
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 200 100">
                    <defs>
                      <linearGradient id="bmiArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3B82F6" /> {/* Blue - Underweight */}
                        <stop offset="30%" stopColor="#10B981" /> {/* Green - Normal */}
                        <stop offset="65%" stopColor="#F59E0B" /> {/* Orange - Overweight */}
                        <stop offset="100%" stopColor="#EF4444" /> {/* Red - Obese */}
                      </linearGradient>
                    </defs>
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="url(#bmiArcGrad)"
                      strokeWidth="16"
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Indicator Pointer */}
                  <div
                    className="absolute bottom-0 left-1/2 w-2 h-16 origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out"
                    style={{ transform: `translateX(-50%) rotate(${getBmiRotation(bmiVal)}deg)` }}
                  >
                    <div className="w-2 h-14 bg-onSurface dark:bg-white rounded-t-full shadow-md" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-onSurface dark:bg-white border-2 border-primary" />
                  </div>
                </div>

                <div className="text-center mt-4 space-y-1.5">
                  <div className="text-3xl font-extrabold text-onSurface dark:text-foreground font-mono">
                    {bmiVal.toFixed(1)}
                  </div>
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-full inline-block border ${bmiStatus.bg} ${bmiStatus.color}`}>
                    {bmiStatus.text}
                  </div>
                </div>

                <div className="border-t border-secondary dark:border-darkBorder mt-6 pt-4 grid grid-cols-3 text-center gap-2 text-xs">
                  <div>
                    <span className="text-onSurface/40 dark:text-foreground/45 block">身高</span>
                    <span className="font-semibold text-onSurface dark:text-foreground font-mono">{profile.height} cm</span>
                  </div>
                  <div>
                    <span className="text-onSurface/40 dark:text-foreground/45 block">体重</span>
                    <span className="font-semibold text-onSurface dark:text-foreground font-mono">{currentWeight} kg</span>
                  </div>
                  <div>
                    <span className="text-onSurface/40 dark:text-foreground/45 block">目标</span>
                    <span className="font-semibold text-onSurface dark:text-foreground font-mono">
                      {profile.target_weight ? `${profile.target_weight} kg` : '未设置'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deficit Circle Panel (Col 7) */}
              <div className="lg:col-span-7 p-8 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-darkCard/40 border border-secondary dark:border-darkBorder shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                
                {/* Text Values (Col 7) */}
                <div className="md:col-span-7 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center space-x-2">
                      <Flame className="h-5 w-5 text-rose-500 animate-pulse" />
                      <span>今日热量赤字缺口</span>
                    </h3>
                    <p className="text-xs text-onSurface/50 dark:text-foreground/50 mt-1">打卡记录今日饮食与健身会自动核算消耗。</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl">
                      <div className="flex items-center space-x-1.5 text-rose-500 font-semibold text-xs mb-1">
                        <Apple size={14} />
                        <span>摄入能量</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-onSurface dark:text-foreground">
                        {totalTodayIntake} <span className="text-xs font-normal text-onSurface/55 dark:text-foreground/55">kcal</span>
                      </div>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                      <div className="flex items-center space-x-1.5 text-emerald-500 font-semibold text-xs mb-1">
                        <Dumbbell size={14} />
                        <span>消耗能量</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-onSurface dark:text-foreground">
                        {totalTodayBurned} <span className="text-xs font-normal text-onSurface/55 dark:text-foreground/55">kcal</span>
                      </div>
                      <div className="text-[10px] text-onSurface/40 dark:text-foreground/45 mt-0.5 font-mono">
                        BMR {Math.round(currentBMR)} + 运动 {Math.round(activeCalories)}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-onSurface/50 dark:text-foreground/50 flex items-center space-x-2 border-t border-secondary dark:border-darkBorder pt-4">
                    <Scale size={14} />
                    <span>最新记录体重与初始建档相差 {Math.abs(currentWeight - profile.initial_weight).toFixed(1)} kg。</span>
                  </div>
                </div>

                {/* SVG Radial Ring (Col 5) */}
                <div className="md:col-span-5 flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center w-36 h-36">
                    <svg className="w-full h-full transform -rotate-90">
                      {/* Grey Track */}
                      <circle
                        cx="72"
                        cy="72"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        className="text-secondary dark:text-darkBorder"
                        strokeWidth={strokeWidth}
                      />
                      {/* Deficit Track (Gradual flame color) */}
                      <circle
                        cx="72"
                        cy="72"
                        r={radius}
                        fill="transparent"
                        stroke={todayDeficit >= 0 ? "#10B981" : "#EF4444"}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circ}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-onSurface/40 dark:text-foreground/45">
                        {todayDeficit >= 0 ? '热量赤字' : '热量超标'}
                      </span>
                      <span className={`text-2xl font-black font-mono leading-none my-1 ${todayDeficit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {Math.abs(todayDeficit)}
                      </span>
                      <span className="text-[10px] font-medium text-onSurface/40 dark:text-foreground/45">kcal</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-onSurface/50 dark:text-foreground/50 mt-4 text-center">
                    {todayDeficit >= 0 ? '👍 保持当前缺口以健康瘦身' : '⚠️ 摄入过剩，可以多运动来消耗'}
                  </span>
                </div>
              </div>
            </section>

            {/* 3. CALENDAR HEATMAP & IMPORT MODULE */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Daily Discipline Calendar (Col 8) */}
              <div className="lg:col-span-8 p-8 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-darkCard/40 border border-secondary dark:border-darkBorder shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span>自律打卡日历</span>
                    </h3>
                    <p className="text-xs text-onSurface/50 dark:text-foreground/50">点击日历中的任何日期来完善当日的饮食与健美记录。</p>
                  </div>

                  {/* Calendar controllers */}
                  <div className="flex items-center space-x-3 bg-secondary/50 dark:bg-darkBorder/40 p-1.5 rounded-xl border border-secondary dark:border-darkBorder">
                    <button
                      onClick={prevMonth}
                      className="p-1 rounded-lg hover:bg-white dark:hover:bg-darkCard transition-all shadow-sm"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold font-mono px-2 text-onSurface dark:text-foreground min-w-[76px] text-center">
                      {year} 年 {month} 月
                    </span>
                    <button
                      onClick={nextMonth}
                      className="p-1 rounded-lg hover:bg-white dark:hover:bg-darkCard transition-all shadow-sm"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {loadingLogs ? (
                  <div className="py-24 flex justify-center">
                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2.5 text-center">
                    {/* Header: Sunday to Saturday */}
                    {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
                      <div key={i} className="text-xs font-semibold py-1.5 text-onSurface/40 dark:text-foreground/45">
                        {day}
                      </div>
                    ))}

                    {/* Date Grid */}
                    {calendarDays.map((cell, idx) => {
                      const dayLog = logs.find(l => l.log_date === cell.dateStr)
                      const isToday = cell.dateStr === todayStr
                      
                      // Determine status colors
                      let statusBg = 'bg-white dark:bg-darkCard/40 border border-secondary dark:border-darkBorder/60 hover:border-primary/45'
                      if (dayLog) {
                        const hasDiet = !!(dayLog.diet_text || dayLog.diet_image_url || dayLog.intake_calories > 0)
                        const hasFitness = !!(dayLog.fitness_text || dayLog.fitness_image_url || (dayLog.active_energy !== null && dayLog.active_energy > 0))
                        
                        if (hasDiet && hasFitness) {
                          // Perfect day (Diet and Fitness both recorded)
                          statusBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15'
                        } else if (hasDiet || hasFitness) {
                          // Standard day
                          statusBg = 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15'
                        }
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => handleOpenDayModal(cell.dateStr)}
                          className={`min-h-[72px] p-2.5 rounded-2xl flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.03] select-none ${statusBg} ${
                            !cell.currentMonth ? 'opacity-30 pointer-events-none' : ''
                          } ${isToday ? 'ring-2 ring-primary/80 ring-offset-2 dark:ring-offset-darkBg' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold font-mono">{cell.dayNum}</span>
                            {dayLog && (dayLog.intake_calories > 0 || dayLog.burned_calories > 0) && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </div>

                          <div className="mt-2.5 space-y-0.5 text-[9px] font-mono leading-tight">
                            {dayLog?.weight && (
                              <div className="text-onSurface/60 dark:text-foreground/60 font-semibold">{dayLog.weight}kg</div>
                            )}
                            {dayLog && dayLog.intake_calories > 0 ? (
                              <div className="text-rose-500">+{dayLog.intake_calories}</div>
                            ) : null}
                            {dayLog && dayLog.burned_calories > 0 ? (
                              <div className="text-emerald-500">-{dayLog.burned_calories}</div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Apple Health Import Module (Col 4) */}
              <div className="lg:col-span-4 p-8 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-darkCard/40 border border-secondary dark:border-darkBorder shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center space-x-2">
                    <UploadCloud className="h-5 w-5 text-primary" />
                    <span>导入苹果健康数据</span>
                  </h3>
                  <p className="text-xs text-onSurface/50 dark:text-foreground/50 mt-1">支持拖拽上传自 iPhone 导出的 `export.zip` 或者 XML 文件。</p>
                </div>

                {/* Drop Zone Box */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] ${
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.02]'
                      : 'border-secondary dark:border-darkBorder bg-white/30 dark:bg-darkCard/20 hover:border-primary/50'
                  }`}
                >
                  <input
                    type="file"
                    id="health-file-input"
                    accept=".zip,.xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAppleHealthUpload(file)
                    }}
                  />
                  <label htmlFor="health-file-input" className="cursor-pointer w-full h-full flex flex-col items-center justify-center space-y-2">
                    <UploadCloud className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-onSurface/40 dark:text-foreground/40'}`} />
                    <div className="text-xs font-semibold text-onSurface/80 dark:text-foreground">点击或拖拽文件到这里</div>
                    <div className="text-[10px] text-onSurface/40 dark:text-foreground/45">支持 export.zip 或 export.xml</div>
                  </label>
                </div>

                {importingFile && (
                  <div className="flex items-center justify-center space-x-2 text-xs text-primary font-medium bg-primary/5 p-3.5 border border-primary/20 rounded-xl animate-pulse">
                    <Loader2 className="animate-spin h-4 w-4" />
                    <span>正在进行高性能流式解压及 XML 解析中...</span>
                  </div>
                )}

                {importResult && (
                  <div className={`p-4 rounded-xl border flex gap-2.5 text-xs ${
                    importResult.success
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/5 border-red-500/20 text-red-500'
                  }`}>
                    {importResult.success ? <Check size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-bold">{importResult.success ? '导入成功' : '导入失败'}</p>
                      <p className="text-[10.5px] mt-0.5 opacity-90 leading-relaxed">{importResult.message}</p>
                    </div>
                  </div>
                )}

                <div className="bg-secondary/40 dark:bg-darkBorder/30 p-4 rounded-2xl space-y-2 text-[11px] leading-relaxed text-onSurface/70 dark:text-foreground/70 border border-secondary dark:border-darkBorder">
                  <h4 className="font-bold flex items-center gap-1 text-onSurface dark:text-foreground">
                    <AlertCircle size={12} className="text-primary" />
                    如何从 iPhone 导出数据？
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 opacity-90 pl-0.5">
                    <li>打开 iPhone 上的“健康” App。</li>
                    <li>点击右上角的个人头像。</li>
                    <li>滑倒最底部，选择“导出所有健康数据”。</li>
                    <li>导出完成后通过微信或隔空投送发给电脑，将获取的 `export.zip` 直接拖拽到上方区域即可。</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* 4. STATISTICS CHARTS (WEIGHT TRENDS & CALORIE CONTRAST) */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Weight trend chart */}
              <div className="p-8 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-darkCard/40 border border-secondary dark:border-darkBorder shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center space-x-2">
                    <Scale className="h-5 w-5 text-primary" />
                    <span>近 30 天体重趋势 (kg)</span>
                  </h3>
                  <p className="text-xs text-onSurface/50 dark:text-foreground/50 mt-1">自动绘制过去 30 天的体重打卡折线，空白数据自动平滑衔接。</p>
                </div>
                {renderWeightChart()}
              </div>

              {/* Calorie trend chart */}
              <div className="p-8 rounded-3xl backdrop-blur-xl bg-white/40 dark:bg-darkCard/40 border border-secondary dark:border-darkBorder shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center space-x-2">
                    <Flame className="h-5 w-5 text-primary" />
                    <span>近 30 天热量摄入与消耗对比 (kcal)</span>
                  </h3>
                  <p className="text-xs text-onSurface/50 dark:text-foreground/50 mt-1">红色表示饮食摄入，绿色表示运动与代谢消耗。对比产生赤字。</p>
                </div>
                {renderCalorieChart()}
              </div>
            </section>
          </>
        )}
      </main>

      {/* 5. DAILY PUNCH LOG DETAIL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-darkCard rounded-3xl border border-secondary dark:border-darkBorder shadow-2xl p-6 sm:p-8 space-y-6 my-8 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-secondary dark:border-darkBorder">
              <div>
                <h3 className="text-xl font-bold text-onSurface dark:text-foreground">自律日常打卡配置</h3>
                <p className="text-xs text-onSurface/40 dark:text-foreground/45 mt-0.5 font-mono">打卡日期: {selectedDateStr}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-onSurface/40 hover:text-onSurface dark:text-foreground/45 dark:hover:text-foreground p-1 text-sm font-semibold rounded-lg hover:bg-secondary dark:hover:bg-darkBorder transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* Section 1: Standard Numeric Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">当天体重 (kg)</label>
                  <div className="relative">
                    <Scale className="absolute left-3.5 top-3 h-4 w-4 text-onSurface/40 dark:text-foreground/45" />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="选填，如：65.4"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="w-full pl-10 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">今日步数</label>
                  <div className="relative">
                    <Footprints className="absolute left-3.5 top-3 h-4 w-4 text-onSurface/40 dark:text-foreground/45" />
                    <input
                      type="number"
                      placeholder="选填"
                      value={editSteps}
                      onChange={(e) => setEditSteps(e.target.value)}
                      className="w-full pl-10 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">运动能量 (kcal)</label>
                  <div className="relative">
                    <Dumbbell className="absolute left-3.5 top-3 h-4 w-4 text-onSurface/40 dark:text-foreground/45" />
                    <input
                      type="number"
                      placeholder="选填，如：350"
                      value={editActiveEnergy}
                      onChange={(e) => setEditActiveEnergy(e.target.value)}
                      className="w-full pl-10 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Diet log with Image & AI */}
              <div className="border border-secondary dark:border-darkBorder/60 p-4.5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-onSurface dark:text-foreground flex items-center gap-1.5">
                    <Apple size={16} className="text-rose-500" />
                    <span>饮食打卡记录</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAIDietEstimate}
                    disabled={analyzingDiet}
                    className="text-xs bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all font-semibold flex items-center gap-1"
                  >
                    {analyzingDiet ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        AI 估算中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        AI 估算卡路里
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8 space-y-3">
                    <textarea
                      placeholder="输入您这一顿饭吃了什么（如：早餐一个煎鸡蛋，一袋牛奶，一片全麦面包）..."
                      rows={3}
                      value={editDietText}
                      onChange={(e) => setEditDietText(e.target.value)}
                      className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    />

                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="block text-[10px] font-semibold text-onSurface/50 dark:text-foreground/45">饮食图片地址 (可上传自动获取)</label>
                        <input
                          type="text"
                          placeholder="图片 URL 地址"
                          value={editDietImageUrl}
                          onChange={(e) => setEditDietImageUrl(e.target.value)}
                          className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-xs text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                        />
                      </div>
                      <div className="flex items-end">
                        <input
                          type="file"
                          id="diet-img-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(file, 'diet')
                          }}
                        />
                        <label
                          htmlFor="diet-img-upload"
                          className="bg-secondary dark:bg-darkBorder hover:bg-primary/10 hover:text-primary transition-all p-2.5 rounded-xl border border-secondary dark:border-darkBorder text-xs font-semibold cursor-pointer block text-center min-w-[72px]"
                        >
                          {uploadingDietImg ? <Loader2 size={14} className="animate-spin mx-auto" /> : '选择图片'}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-4 flex items-center justify-center border border-secondary dark:border-darkBorder rounded-xl bg-secondary/10 dark:bg-darkBg/20 aspect-video sm:aspect-square overflow-hidden relative">
                    {editDietImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editDietImageUrl} alt="饮食照片" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-onSurface/40 dark:text-foreground/45">未上传饮食图</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-w-[200px]">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">整餐摄入热量 (kcal)</label>
                  <input
                    type="number"
                    placeholder="例如：420"
                    value={editIntakeCalories}
                    onChange={(e) => setEditIntakeCalories(e.target.value)}
                    className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                  />
                </div>
              </div>

              {/* Section 3: Fitness log with Image & AI */}
              <div className="border border-secondary dark:border-darkBorder/60 p-4.5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-onSurface dark:text-foreground flex items-center gap-1.5">
                    <Dumbbell size={16} className="text-emerald-500" />
                    <span>健身打卡记录</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAIFitnessEstimate}
                    disabled={analyzingFitness}
                    className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all font-semibold flex items-center gap-1"
                  >
                    {analyzingFitness ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        AI 估算中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        AI 估算卡路里
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8 space-y-3">
                    <textarea
                      placeholder="输入您的运动类型、时长或强度描述（如：跑步 30 分钟，配速 5分30秒）..."
                      rows={3}
                      value={editFitnessText}
                      onChange={(e) => setEditFitnessText(e.target.value)}
                      className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    />

                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="block text-[10px] font-semibold text-onSurface/50 dark:text-foreground/45">健身截图地址 (可上传图片)</label>
                        <input
                          type="text"
                          placeholder="图片 URL 地址"
                          value={editFitnessImageUrl}
                          onChange={(e) => setEditFitnessImageUrl(e.target.value)}
                          className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-xs text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                        />
                      </div>
                      <div className="flex items-end">
                        <input
                          type="file"
                          id="fitness-img-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(file, 'fitness')
                          }}
                        />
                        <label
                          htmlFor="fitness-img-upload"
                          className="bg-secondary dark:bg-darkBorder hover:bg-primary/10 hover:text-primary transition-all p-2.5 rounded-xl border border-secondary dark:border-darkBorder text-xs font-semibold cursor-pointer block text-center min-w-[72px]"
                        >
                          {uploadingFitnessImg ? <Loader2 size={14} className="animate-spin mx-auto" /> : '选择图片'}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-4 flex items-center justify-center border border-secondary dark:border-darkBorder rounded-xl bg-secondary/10 dark:bg-darkBg/20 aspect-video sm:aspect-square overflow-hidden relative">
                    {editFitnessImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editFitnessImageUrl} alt="健身打卡" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-onSurface/40 dark:text-foreground/45">未上传健身图</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-w-[200px]">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">总活动消耗热量 (kcal)</label>
                  <input
                    type="number"
                    placeholder="包含运动和日常代谢，可手动填"
                    value={editBurnedCalories}
                    onChange={(e) => setEditBurnedCalories(e.target.value)}
                    className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                  />
                  <span className="text-[10px] text-onSurface/40 dark:text-foreground/45">若空缺，保存时系统将根据您的 BMR 和活动能量自动填充。</span>
                </div>
              </div>

              {/* Section 4: AI Analysis Output Preview */}
              {aiAnalysis && (
                <div className="bg-primary/5 border border-primary/20 p-4.5 rounded-2xl space-y-1">
                  <div className="text-xs font-bold text-primary flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>AI 营养与运动点评诊断</span>
                  </div>
                  <p className="text-xs text-onSurface/80 dark:text-foreground/80 leading-relaxed font-mono whitespace-pre-wrap">
                    {aiAnalysis}
                  </p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-secondary dark:border-darkBorder">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="font-semibold text-xs py-2 px-4 rounded-xl"
              >
                取消
              </Button>
              <Button
                disabled={savingLog}
                onClick={handleSaveDailyLog}
                className="bg-primary hover:bg-primary-hover text-white font-semibold text-xs py-2 px-4 rounded-xl"
              >
                {savingLog ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4.5 w-4.5" />
                    正在打卡保存...
                  </>
                ) : (
                  '保存今日自律记录'
                )}
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
