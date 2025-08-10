// Monte Carlo Web Worker (public/workers/monteCarlo.js)
// This file should be placed in public/workers/monteCarlo.js

// Monte Carlo simulation worker for background processing
self.onmessage = function(event) {
  const { type, parameters } = event.data

  switch (type) {
    case 'start':
      runMonteCarloSimulation(parameters)
      break
    case 'cancel':
      // Handle cancellation
      self.postMessage({ type: 'cancelled' })
      break
    default:
      self.postMessage({ type: 'error', error: 'Unknown message type' })
  }
}

function runMonteCarloSimulation(params) {
  const {
    initialValuation,
    growthRateMean,
    growthRateStdDev,
    exitMultiplierMean,
    exitMultiplierStdDev,
    timeHorizon,
    iterations = 10000,
    discountRate = 0.1
  } = params

  const results = []
  const progressInterval = Math.max(1, Math.floor(iterations / 100))

  try {
    for (let i = 0; i < iterations; i++) {
      // Generate random growth rate (log-normal distribution)
      const growthRate = generateLogNormal(growthRateMean, growthRateStdDev)
      
      // Generate random exit multiplier
      const exitMultiplier = generateLogNormal(exitMultiplierMean, exitMultiplierStdDev)
      
      // Calculate future valuation
      const futureValuation = initialValuation * Math.pow(1 + growthRate, timeHorizon)
      
      // Calculate exit value
      const exitValue = futureValuation * exitMultiplier
      
      // Calculate present value
      const presentValue = exitValue / Math.pow(1 + discountRate, timeHorizon)
      
      // Calculate returns
      const totalReturn = exitValue / initialValuation
      const annualizedReturn = Math.pow(totalReturn, 1 / timeHorizon) - 1
      
      results.push({
        iteration: i,
        growthRate,
        exitMultiplier,
        futureValuation,
        exitValue,
        presentValue,
        totalReturn,
        annualizedReturn
      })

      // Report progress
      if (i % progressInterval === 0) {
        self.postMessage({
          type: 'progress',
          data: {
            progress: (i / iterations) * 100,
            iteration: i,
            totalIterations: iterations
          }
        })
      }
    }

    // Calculate statistics
    const statistics = calculateStatistics(results)
    
    // Send final results
    self.postMessage({
      type: 'result',
      data: {
        results,
        statistics,
        parameters: params
      }
    })

  } catch (error) {
    self.postMessage({
      type: 'error',
      data: { error: error.message }
    })
  }
}

function generateLogNormal(mu, sigma) {
  // Box-Muller transformation for normal distribution
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  
  // Convert to log-normal
  return Math.exp(mu + sigma * z0)
}

function calculateStatistics(results) {
  const presentValues = results.map(r => r.presentValue)
  const totalReturns = results.map(r => r.totalReturn)
  const annualizedReturns = results.map(r => r.annualizedReturn)

  return {
    presentValue: {
      mean: calculateMean(presentValues),
      median: calculatePercentile(presentValues, 50),
      stdDev: calculateStdDev(presentValues),
      percentiles: {
        p5: calculatePercentile(presentValues, 5),
        p10: calculatePercentile(presentValues, 10),
        p25: calculatePercentile(presentValues, 25),
        p75: calculatePercentile(presentValues, 75),
        p90: calculatePercentile(presentValues, 90),
        p95: calculatePercentile(presentValues, 95)
      }
    },
    totalReturn: {
      mean: calculateMean(totalReturns),
      median: calculatePercentile(totalReturns, 50),
      stdDev: calculateStdDev(totalReturns),
      percentiles: {
        p5: calculatePercentile(totalReturns, 5),
        p10: calculatePercentile(totalReturns, 10),
        p25: calculatePercentile(totalReturns, 25),
        p75: calculatePercentile(totalReturns, 75),
        p90: calculatePercentile(totalReturns, 90),
        p95: calculatePercentile(totalReturns, 95)
      }
    },
    annualizedReturn: {
      mean: calculateMean(annualizedReturns),
      median: calculatePercentile(annualizedReturns, 50),
      stdDev: calculateStdDev(annualizedReturns),
      percentiles: {
        p5: calculatePercentile(annualizedReturns, 5),
        p10: calculatePercentile(annualizedReturns, 10),
        p25: calculatePercentile(annualizedReturns, 25),
        p75: calculatePercentile(annualizedReturns, 75),
        p90: calculatePercentile(annualizedReturns, 90),
        p95: calculatePercentile(annualizedReturns, 95)
      }
    },
    probabilityOfLoss: calculateProbabilityOfLoss(totalReturns),
    expectedShortfall: calculateExpectedShortfall(totalReturns, 5)
  }
}

function calculateMean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateStdDev(values) {
  const mean = calculateMean(values)
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2))
  const variance = calculateMean(squaredDiffs)
  return Math.sqrt(variance)
}

function calculatePercentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = (percentile / 100) * (sorted.length - 1)
  
  if (Number.isInteger(index)) {
    return sorted[index]
  } else {
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }
}

function calculateProbabilityOfLoss(returns) {
  const losses = returns.filter(r => r < 1).length
  return (losses / returns.length) * 100
}

function calculateExpectedShortfall(returns, percentile) {
  const sorted = [...returns].sort((a, b) => a - b)
  const cutoffIndex = Math.floor((percentile / 100) * sorted.length)
  const tailValues = sorted.slice(0, cutoffIndex)
  return tailValues.length > 0 ? calculateMean(tailValues) : 0
}

// React hook for using the Monte Carlo worker
// This would go in a separate file: hooks/useMonteCarloWorker.js

import { useRef, useState, useCallback, useEffect } from 'react'

export const useMonteCarloWorker = () => {
  const workerRef = useRef()
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker('/workers/monteCarlo.js')
    
    workerRef.current.onmessage = (event) => {
      const { type, data } = event.data
      
      switch (type) {
        case 'progress':
          setProgress(data.progress)
          break
        case 'result':
          setResults(data)
          setIsRunning(false)
          setProgress(100)
          break
        case 'error':
          setError(data.error)
          setIsRunning(false)
          break
        case 'cancelled':
          setIsRunning(false)
          setProgress(0)
          break
      }
    }

    workerRef.current.onerror = (error) => {
      setError('Worker error: ' + error.message)
      setIsRunning(false)
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  const runSimulation = useCallback((parameters) => {
    setIsRunning(true)
    setProgress(0)
    setResults(null)
    setError(null)
    
    workerRef.current.postMessage({
      type: 'start',
      parameters
    })
  }, [])

  const cancelSimulation = useCallback(() => {
    workerRef.current.postMessage({ type: 'cancel' })
    setIsRunning(false)
    setProgress(0)
  }, [])

  return {
    runSimulation,
    cancelSimulation,
    isRunning,
    progress,
    results,
    error
  }
}