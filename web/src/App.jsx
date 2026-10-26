import { Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import AppLayout from './components/AppLayout'
import Permission from './components/Permission'
import CertificatsPage from './pages/CertificatsPage'
import ClassesPage from './pages/ClassesPage'
import DashboardPage from './pages/DashboardPage'
import ElevesPage from './pages/ElevesPage'
import GroupesPage from './pages/GroupesPage'
import LoginPage from './pages/LoginPage'
import MatieresPage from './pages/MatieresPage'
import NotFoundPage from './pages/NotFoundPage'
import PaiementsPage from './pages/PaiementsPage'
import ParametresPage from './pages/ParametresPage'
import ProfesseursPage from './pages/ProfesseursPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />

          <Route
            path="eleves"
            element={
              <Permission permission="eleves">
                <ElevesPage />
              </Permission>
            }
          />
          <Route
            path="professeurs"
            element={
              <Permission permission="professeurs">
                <ProfesseursPage />
              </Permission>
            }
          />
          <Route
            path="classes"
            element={
              <Permission permission="classes">
                <ClassesPage />
              </Permission>
            }
          />
          <Route
            path="matieres"
            element={
              <Permission permission="matieres">
                <MatieresPage />
              </Permission>
            }
          />
          <Route
            path="paiements"
            element={
              <Permission permission="paiements">
                <PaiementsPage />
              </Permission>
            }
          />
          <Route
            path="groupes"
            element={
              <Permission permission="groupes">
                <GroupesPage />
              </Permission>
            }
          />
          <Route
            path="certificats"
            element={
              <Permission permission="certificats">
                <CertificatsPage />
              </Permission>
            }
          />
          <Route
            path="parametres"
            element={
              <Permission permission="parametres">
                <ParametresPage />
              </Permission>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
