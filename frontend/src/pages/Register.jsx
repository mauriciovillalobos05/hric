// src/pages/Register.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const defaultRole = queryParams.get('role')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState(defaultRole)
  const [countryCode, setCountryCode] = useState('US') // fallback
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => setCountryCode(data.country_code))
      .catch(() => setCountryCode('US'))
  }, [])

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!isValidPhoneNumber(phone, countryCode)) {
      setError('Please enter a valid phone number.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:5173/onboarding',
        data: {
          name,
          phone,
          role: role || null
        }
      }
    })

    if (error) {
      setError(error.message)
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <Badge className="bg-blue-100 text-blue-800 mb-2">Create Your HRIC Account</Badge>
          <CardTitle className="text-2xl font-bold text-gray-900">Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <p className="text-xs text-gray-500">Include country code if possible</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {!defaultRole && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Role</label>
                <div className="flex space-x-2 mt-1">
                  <Button type="button" variant={role === 'investor' ? 'default' : 'outline'} onClick={() => setRole('investor')}>
                    Investor
                  </Button>
                  <Button type="button" variant={role === 'entrepreneur' ? 'default' : 'outline'} onClick={() => setRole('entrepreneur')}>
                    Entrepreneur
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Register'}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-600 mt-6">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline">
              Log in
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
