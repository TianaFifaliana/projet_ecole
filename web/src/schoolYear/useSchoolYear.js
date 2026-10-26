import { useContext } from 'react'
import { SchoolYearContext } from './context'

export default function useSchoolYear() {
  const context = useContext(SchoolYearContext)

  if (!context) {
    throw new Error(
      "useSchoolYear doit être utilisé à l'intérieur de SchoolYearProvider.",
    )
  }

  return context
}
