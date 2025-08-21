// Enhanced Portfolio Management Component with real-time updates
import React, { memo, useMemo, useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVirtualPortfolio, useRealtimePortfolio } from '../hooks/useData'
import { useAuth } from '../contexts/AuthContext'
import { PlusCircle, TrendingUp, TrendingDown, DollarSign, Percent, Target, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const PortfolioManagement = memo(() => {
  const { user } = useAuth()
  const [isAddingInvestment, setIsAddingInvestment] = useState(false)
  const [selectedTimeframe, setSelectedTimeframe] = useState('1Y')
  
  const {
    portfolio,
    isLoading,
    error,
    addInvestment,
    removeInvestment,
    isAddingInvestment: isAddingMutation
  } = useVirtualPortfolio(user?.id)

  // Real-time updates
  useRealtimePortfolio(user?.id)

  // Portfolio calculations
  const portfolioMetrics = useMemo(() => {
    if (!portfolio?.virtual_portfolio_item) return null

    const items = portfolio.virtual_portfolio_item
    const totalInvestment = items.reduce((sum, item) => sum + item.investment_amount, 0)
    const totalCurrentValue = items.reduce((sum, item) => sum + (item.current_valuation || item.investment_amount), 0)
    const totalGainLoss = totalCurrentValue - totalInvestment
    const percentageReturn = totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0

    return {
      totalInvestment,
      totalCurrentValue,
      totalGainLoss,
      percentageReturn,
      numberOfInvestments: items.length
    }
  }, [portfolio])

  // Portfolio diversification data
  const diversificationData = useMemo(() => {
    if (!portfolio?.virtual_portfolio_item) return []

    const industryMap = new Map()
    portfolio.virtual_portfolio_item.forEach(item => {
      const industry = item.startup?.startup_profile?.industry || 'Unknown'
      const current = industryMap.get(industry) || 0
      industryMap.set(industry, current + (item.current_valuation || item.investment_amount))
    })

    return Array.from(industryMap.entries()).map(([industry, value]) => ({
      name: industry,
      value,
      percentage: portfolioMetrics ? (value / portfolioMetrics.totalCurrentValue) * 100 : 0
    }))
  }, [portfolio, portfolioMetrics])

  // Portfolio performance over time (mock data - would come from backend)
  const performanceData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map((month, index) => ({
      month,
      value: portfolioMetrics ? portfolioMetrics.totalCurrentValue * (0.8 + (index * 0.03)) : 0,
      benchmark: portfolioMetrics ? portfolioMetrics.totalCurrentValue * (0.85 + (index * 0.02)) : 0
    }))
  }, [portfolioMetrics])

  const handleAddInvestment = useCallback(async (investmentData) => {
    try {
      await addInvestment(investmentData)
      setIsAddingInvestment(false)
    } catch (error) {
      console.error('Failed to add investment:', error)
    }
  }, [addInvestment])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading portfolio...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-8">
        <p>Error loading portfolio: {error.message}</p>
      </div>
    )
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  return (
    <div className="space-y-6 p-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolioMetrics?.totalInvestment?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Value</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolioMetrics?.totalCurrentValue?.toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Return</CardTitle>
            {portfolioMetrics?.totalGainLoss >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              portfolioMetrics?.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${portfolioMetrics?.totalGainLoss?.toLocaleString() || '0'}
            </div>
            <p className={`text-xs ${
              portfolioMetrics?.percentageReturn >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {portfolioMetrics?.percentageReturn?.toFixed(2) || '0'}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investments</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolioMetrics?.numberOfInvestments || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Portfolio Performance</CardTitle>
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1M">1M</SelectItem>
                  <SelectItem value="3M">3M</SelectItem>
                  <SelectItem value="6M">6M</SelectItem>
                  <SelectItem value="1Y">1Y</SelectItem>
                  <SelectItem value="ALL">ALL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value?.toLocaleString()}`, '']} />
                <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} name="Portfolio" />
                <Line type="monotone" dataKey="benchmark" stroke="#10B981" strokeWidth={2} name="Benchmark" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Diversification Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Diversification</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={diversificationData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                >
                  {diversificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value?.toLocaleString()}`, 'Value']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Holdings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Portfolio Holdings</CardTitle>
            <Dialog open={isAddingInvestment} onOpenChange={setIsAddingInvestment}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Investment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Investment</DialogTitle>
                </DialogHeader>
                <AddInvestmentForm 
                  onSubmit={handleAddInvestment}
                  isLoading={isAddingMutation}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {portfolio?.virtual_portfolio_item?.length > 0 ? (
            <div className="space-y-4">
              {portfolio.virtual_portfolio_item.map((item) => (
                <PortfolioItem 
                  key={item.portfolio_item_id} 
                  item={item} 
                  onRemove={removeInvestment}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No investments in your portfolio yet.</p>
              <p className="text-sm mt-1">Add your first investment to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})

// Portfolio Item Component
const PortfolioItem = memo(({ item, onRemove }) => {
  const gain = (item.current_valuation || item.investment_amount) - item.investment_amount
  const gainPercentage = (gain / item.investment_amount) * 100

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <h3 className="font-medium">{item.startup?.name || 'Unknown Startup'}</h3>
        <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
          <span>Invested: ${item.investment_amount?.toLocaleString()}</span>
          <span>Current: ${(item.current_valuation || item.investment_amount)?.toLocaleString()}</span>
          <span className={gain >= 0 ? 'text-green-600' : 'text-red-600'}>
            {gain >= 0 ? '+' : ''}${gain?.toLocaleString()} ({gainPercentage?.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Badge variant={item.startup?.startup_profile?.stage ? 'secondary' : 'outline'}>
          {item.startup?.startup_profile?.stage || 'Unknown Stage'}
        </Badge>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onRemove(item.portfolio_item_id)}
          className="text-red-600 hover:text-red-700"
        >
          Remove
        </Button>
      </div>
    </div>
  )
})

// Add Investment Form Component
const AddInvestmentForm = memo(({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    startupId: '',
    amount: '',
    notes: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      startupId: formData.startupId,
      amount: parseFloat(formData.amount),
      notes: formData.notes
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Startup ID</label>
        <Input
          type="text"
          value={formData.startupId}
          onChange={(e) => setFormData({...formData, startupId: e.target.value})}
          placeholder="Enter startup ID"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Investment Amount</label>
        <Input
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData({...formData, amount: e.target.value})}
          placeholder="Enter amount"
          min="0"
          step="0.01"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Add notes about this investment"
          rows={3}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Adding...' : 'Add Investment'}
      </Button>
    </form>
  )
})

PortfolioManagement.displayName = 'PortfolioManagement'
PortfolioItem.displayName = 'PortfolioItem'
AddInvestmentForm.displayName = 'AddInvestmentForm'

export default PortfolioManagement