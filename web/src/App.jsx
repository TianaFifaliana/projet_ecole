import { Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import AppLayout from './components/AppLayout'
import Permission from './components/Permission'
import AnneesPage from './pages/AnneesPage'
import CertificatsPage from './pages/CertificatsPage'
import ClasseDetailPage from './pages/ClasseDetailPage'
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
import StudentDetailPage from './pages/StudentDetailPage'
import StudentFormPage from './pages/StudentFormPage'

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
            path="eleves/nouveau"
            element={
              <Permission permission="eleves">
                <StudentFormPage />
              </Permission>
            }
          />
          <Route
            path="eleves/:id"
            element={
              <Permission permission="eleves">
                <StudentDetailPage />
              </Permission>
            }
          />
          <Route
            path="eleves/:id/modifier"
            element={
              <Permission permission="eleves">
                <StudentFormPage />
              </Permission>
            }
          />
          <Route
            path="annees"
            element={
              <Permission permission="parametres">
                <AnneesPage />
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
            path="classes/:id"
            element={
              <Permission permission="classes">
                <ClasseDetailPage />
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
