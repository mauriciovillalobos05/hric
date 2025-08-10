import React, { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMonteCarloWorker } from './monte_carlo_worker'
import { Play, Square, Download, Settings, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  HistogramChart, ReferenceLine, AreaChart, Area, ScatterChart, Scatter
} from 'recharts'

const MonteCarloSimulation = memo(({ startupData, className = '' }) => {
  const { runSimulation, cancelSimulation, isRunning, progress, results, error } = useMonteCarloWorker()
  
  const [parameters, setParameters] = useState({
    initialValuation: startupData?.valuation || 1000000,
    growthRateMean: 0.3, // 30% annual growth
    growthRateStdDev: 0.15, // 15% standard deviation
    exitMultiplierMean: 5, // 5x exit multiple
    exitMultiplierStdDev: 2, // 2x standard deviation
    timeHorizon: 5, // 5 years
    iterations: 10000,
    discountRate: 0.1 // 10% discount rate
  })
  
  const [activeTab, setActiveTab] = useState('setup')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auto-switch to results tab when simulation completes
  useEffect(() => {
    if (results && !isRunning) {
      setActiveTab('results')
    }
  }, [results, isRunning])

  // Handle parameter changes
  const handleParameterChange = useCallback((field, value) => {
    setParameters(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }))
  }, [])

  // Start simulation
  const handleRunSimulation = useCallback(() => {
    runSimulation(parameters)
    setActiveTab('running')
  }, [runSimulation, parameters])

  // Cancel simulation
  const handleCancelSimulation = useCallback(() => {
    cancelSimulation()
    setActiveTab('setup')
  }, [cancelSimulation])

  // Memoized visualization data
  const visualizationData = useMemo(() => {
    if (!results?.results) return null

    const { results: rawResults, statistics } = results
    
    // Histogram data for returns distribution
    const returnHistogram = []
    const bins = 50
    const returns = rawResults.map(r => r.totalReturn)
    const minReturn = Math.min(...returns)
    const maxReturn = Math.max(...returns)
    const binSize = (maxReturn - minReturn) / bins
    
    for (let i = 0; i < bins; i++) {
      const binStart = minReturn + i * binSize
      const binEnd = binStart + binSize
      const count = returns.filter(r => r >= binStart && r < binEnd).length
      returnHistogram.push({
        bin: binStart,
        count,
        percentage: (count / returns.length) * 100
      })
    }

    // Time series data for scenario paths (sample)
    const scenarioPaths = rawResults.slice(0, 100).map((result, index) => ({
      scenario: index,
      year0: parameters.initialValuation,
      year1: parameters.initialValuation * Math.pow(1 + result.growthRate, 1),
      year2: parameters.initialValuation * Math.pow(1 + result.growthRate, 2),
      year3: parameters.initialValuation * Math.pow(1 + result.growthRate, 3),
      year4: parameters.initialValuation * Math.pow(1 + result.growthRate, 4),
      year5: result.futureValuation
    }))

    // Percentile data
    const percentileData = [
      { percentile: 'P5', value: statistics.totalReturn.percentiles.p5 },
      { percentile: 'P10', value: statistics.totalReturn.percentiles.p10 },
      { percentile: 'P25', value: statistics.totalReturn.percentiles.p25 },
      { percentile: 'P50', value: statistics.totalReturn.median },
      { percentile: 'P75', value: statistics.totalReturn.percentiles.p75 },
      { percentile: 'P90', value: statistics.totalReturn.percentiles.p90 },
      { percentile: 'P95', value: statistics.totalReturn.percentiles.p95 }
    ]

    return {
      returnHistogram,
      scenarioPaths,
      percentileData,
      statistics
    }
  }, [results, parameters])

  // Export results
  const handleExportResults = useCallback(() => {
    if (!results) return
    
    const exportData = {
      parameters,
      statistics: results.statistics,
      timestamp: new Date().toISOString(),
      startup: startupData?.name || 'Unknown'
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monte-carlo-simulation-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [results, parameters, startupData])

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Monte Carlo Simulation
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {startupData?.name ? `Analyzing ${startupData.name}` : 'Investment Scenario Analysis'}
              </p>
            </div>
            {results && (
              <Button onClick={handleExportResults} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="running" disabled={!isRunning}>Running</TabsTrigger>
              <TabsTrigger value="results" disabled={!results}>Results</TabsTrigger>
              <TabsTrigger value="analysis" disabled={!results}>Analysis</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Parameters</h3>
                  
                  <div>
                    <Label htmlFor="initialValuation">Initial Valuation ($)</Label>
                    <Input
                      id="initialValuation"
                      type="number"
                      value={parameters.initialValuation}
                      onChange={(e) => handleParameterChange('initialValuation', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="timeHorizon">Time Horizon (years)</Label>
                    <Select
                      value={parameters.timeHorizon.toString()}
                      onValueChange={(value) => handleParameterChange('timeHorizon', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="5">5 years</SelectItem>
                        <SelectItem value="7">7 years</SelectItem>
                        <SelectItem value="10">10 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="iterations">Simulation Iterations</Label>
                    <Select
                      value={parameters.iterations.toString()}
                      onValueChange={(value) => handleParameterChange('iterations', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1000">1,000 (Fast)</SelectItem>
                        <SelectItem value="10000">10,000 (Standard)</SelectItem>
                        <SelectItem value="50000">50,000 (Detailed)</SelectItem>
                        <SelectItem value="100000">100,000 (Maximum)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Advanced Parameters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {showAdvanced ? 'Hide' : 'Show'} Advanced
                    </Button>
                  </div>
                  
                  {showAdvanced && (
                    <>
                      <div>
                        <Label htmlFor="growthRateMean">Annual Growth Rate Mean</Label>
                        <Input
                          id="growthRateMean"
                          type="number"
                          step="0.01"
                          value={parameters.growthRateMean}
                          onChange={(e) => handleParameterChange('growthRateMean', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {(parameters.growthRateMean * 100).toFixed(1)}% annual growth
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="growthRateStdDev">Growth Rate Std Dev</Label>
                        <Input
                          id="growthRateStdDev"
                          type="number"
                          step="0.01"
                          value={parameters.growthRateStdDev}
                          onChange={(e) => handleParameterChange('growthRateStdDev', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="exitMultiplierMean">Exit Multiple Mean</Label>
                        <Input
                          id="exitMultiplierMean"
                          type="number"
                          step="0.1"
                          value={parameters.exitMultiplierMean}
                          onChange={(e) => handleParameterChange('exitMultiplierMean', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="exitMultiplierStdDev">Exit Multiple Std Dev</Label>
                        <Input
                          id="exitMultiplierStdDev"
                          type="number"
                          step="0.1"
                          value={parameters.exitMultiplierStdDev}
                          onChange={(e) => handleParameterChange('exitMultiplierStdDev', e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="discountRate">Discount Rate</Label>
                        <Input
                          id="discountRate"
                          type="number"
                          step="0.01"
                          value={parameters.discountRate}
                          onChange={(e) => handleParameterChange('discountRate', e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {(parameters.discountRate * 100).toFixed(1)}% annual discount
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center pt-4">
                <Button onClick={handleRunSimulation} disabled={isRunning} size="lg">
                  <Play className="w-4 h-4 mr-2" />
                  Run Simulation
                </Button>
              </div>
            </TabsContent>

            {/* Running Tab */}
            <TabsContent value="running" className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">Simulation Running</h3>
                  <p className="text-sm text-gray-600">
                    Processing {parameters.iterations.toLocaleString()} scenarios...
                  </p>
                </div>
                
                <div className="max-w-md mx-auto space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-gray-500">
                    {progress.toFixed(1)}% complete
                  </p>
                </div>
                
                <Button onClick={handleCancelSimulation} variant="outline">
                  <Square className="w-4 h-4 mr-2" />
                  Cancel Simulation
                </Button>
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-6">
              {visualizationData && (
                <>
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Expected Return</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {(visualizationData.statistics.totalReturn.mean).toFixed(2)}x
                        </div>
                        <div className="text-xs text-gray-500">
                          {((visualizationData.statistics.totalReturn.mean - 1) * 100).toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Median Return</div>
                        <div className="text-2xl font-bold text-green-600">
                          {visualizationData.statistics.totalReturn.median.toFixed(2)}x
                        </div>
                        <div className="text-xs text-gray-500">
                          50th percentile
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">Probability of Loss</div>
                        <div className="text-2xl font-bold text-red-600">
                          {visualizationData.statistics.probabilityOfLoss.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          Returns 1x
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">95th Percentile</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {visualizationData.statistics.totalReturn.percentiles.p95.toFixed(2)}x
                        </div>
                        <div className="text-xs text-gray-500">
                          Best 5% scenarios
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Return Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Return Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={visualizationData.returnHistogram}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="bin" 
                            tickFormatter={(value) => `${value.toFixed(1)}x`}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value, name) => [
                              `${value.toFixed(1)}%`, 
                              'Probability'
                            ]}
                            labelFormatter={(value) => `Return: ${value.toFixed(1)}x`}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="percentage" 
                            stroke="#3B82F6" 
                            fill="#3B82F6" 
                            fillOpacity={0.3}
                          />
                          <ReferenceLine 
                            x={1} 
                            stroke="#EF4444" 
                            strokeDasharray="5 5"
                            label="Break-even"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Percentile Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Percentile Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-7 gap-2">
                        {visualizationData.percentileData.map((item) => (
                          <div key={item.percentile} className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-sm font-medium text-gray-600">
                              {item.percentile}
                            </div>
                            <div className="text-lg font-bold">
                              {item.value.toFixed(2)}x
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              
              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">Simulation Error</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="space-y-6">
              {visualizationData && (
                <>
                  {/* Scenario Paths */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Sample Scenario Paths</CardTitle>
                      <p className="text-sm text-gray-600">
                        100 random scenarios showing potential valuation growth over time
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={visualizationData.scenarioPaths}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="scenario" />
                          <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                          <Tooltip 
                            formatter={(value) => [`$${(value / 1000000).toFixed(2)}M`, 'Valuation']}
                          />
                          {[0, 1, 2, 3, 4, 5].map(year => (
                            <Line
                              key={year}
                              type="monotone"
                              dataKey={`year${year}`}
                              stroke={`hsl(${year * 60}, 70%, 50%)`}
                              strokeWidth={1}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Risk Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium mb-3">Key Risk Metrics</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm">Value at Risk (5%)</span>
                              <span className="font-medium">
                                {visualizationData.statistics.totalReturn.percentiles.p5.toFixed(2)}x
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Expected Shortfall</span>
                              <span className="font-medium">
                                {visualizationData.statistics.expectedShortfall.toFixed(2)}x
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Standard Deviation</span>
                              <span className="font-medium">
                                {visualizationData.statistics.totalReturn.stdDev.toFixed(2)}x
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-3">Investment Insights</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                              <span>
                                There's a {(100 - visualizationData.statistics.probabilityOfLoss).toFixed(1)}% 
                                chance of positive returns
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                              <span>
                                25% chance of returns exceeding{' '}
                                {visualizationData.statistics.totalReturn.percentiles.p75.toFixed(2)}x
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                              <span>
                                Expected annualized return: {' '}
                                {(visualizationData.statistics.annualizedReturn.mean * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
})

MonteCarloSimulation.displayName = 'MonteCarloSimulation'

export default MonteCarloSimulation