import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LockKeyhole, Mail, Wrench } from 'lucide-react'

type Props = { client: SupabaseClient | null }

export default function AuthScreen({ client }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client) return
    setBusy(true)
    setError('')
    const { error: authError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    if (authError) {
      const message = authError.message.toLowerCase()
      if (message.includes('invalid login credentials')) setError('Email hoặc mật khẩu không chính xác.')
      else if (message.includes('email not confirmed')) setError('Email chưa được xác nhận. Hãy xác nhận email trong hộp thư trước khi đăng nhập.')
      else setError('Đăng nhập chưa thành công: ' + authError.message)
    }
    setBusy(false)
  }

  return <main className="auth-page">
    <section className="auth-card">
      <div className="auth-brand"><span><Wrench size={25}/></span><div><b>BAOTRI</b><small>QUẢN LÝ BẢO TRÌ</small></div></div>
      <h1>Đăng nhập hệ thống</h1>
      <p className="auth-intro">Sử dụng tài khoản đã được tạo và cấp quyền trong hệ thống Supabase.</p>
      {!client ? <div className="auth-error">Chưa có cấu hình Supabase. Hãy kiểm tra file <code>.env.local</code> ở thư mục gốc, gồm <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, sau đó khởi động lại Vite.</div> : <form onSubmit={submit} className="auth-form">
        <label>Email đăng nhập</label>
        <div className="auth-input"><Mail size={17}/><input type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></div>
        <label>Mật khẩu</label>
        <div className="auth-input"><LockKeyhole size={17}/><input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="Nhập mật khẩu"/></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy?'Đang xác thực…':'Đăng nhập'}</button>
      </form>}
      <div className="auth-note"><b>Lưu ý:</b> Đợt đầu chưa bật đăng ký tự do hoặc tự cấp quyền Admin. Tài khoản được tạo/quản lý trong Supabase Dashboard. Dữ liệu thiết bị hiện tại vẫn lưu cục bộ trên trình duyệt, chưa đồng bộ hoặc cách ly theo tài khoản.</div>
    </section>
  </main>
}
