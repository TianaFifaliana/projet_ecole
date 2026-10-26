import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useAuth from '../auth/useAuth'
import { listSchoolYears } from '../api/schoolYears'
import { SchoolYearContext } from './context'

const STORAGE_KEY = 'ecole.schoolYearId'

function readStoredYearId() {
  const value = Number(window.localStorage.getItem(STORAGE_KEY))
  return Number.isInteger(value) && value > 0 ? value : null
}

export function SchoolYearProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [storedYearId, setStoredYearId] = useState(readStoredYearId)

  const yearsQuery = useQuery({
    queryKey: ['school-years'],
    queryFn: listSchoolYears,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data])

  const selectedYearId = useMemo(() => {
    if (years.length === 0) {
      return null
    }

    if (storedYearId && years.some((year) => year.id === storedYearId)) {
      return storedYearId
    }

    const fallback = years.find((year) => year.active) ?? years[0]
    return fallback?.id ?? null
  }, [years, storedYearId])

  useEffect(() => {
    if (selectedYearId) {
      window.localStorage.setItem(STORAGE_KEY, String(selectedYearId))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedYearId])

  const selectYear = useCallback((id) => {
    setStoredYearId(Number(id) || null)
  }, [])

  const refreshYears = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['school-years'] })
  }, [queryClient])

  const selectedYear = useMemo(
    () => years.find((year) => year.id === selectedYearId) ?? null,
    [years, selectedYearId],
  )

  const value = useMemo(
    () => ({
      years,
      selectedYearId,
      selectedYear,
      activeYear: years.find((year) => year.active) ?? null,
      isLoading: yearsQuery.isLoading,
      setSelectedYearId: selectYear,
      refreshYears,
    }),
    [
      years,
      selectedYearId,
      selectedYear,
      yearsQuery.isLoading,
      selectYear,
      refreshYears,
    ],
  )

  return (
    <SchoolYearContext.Provider value={value}>
      {children}
    </SchoolYearContext.Provider>
  )
}
