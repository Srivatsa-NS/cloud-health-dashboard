import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AlertsProvider } from "@/context/AlertsContext"
import Navbar from "@/components/Navbar"
import ToastContainer from "@/components/ToastContainer"
import Dashboard from "@/pages/Dashboard"
import EC2Page from "@/pages/EC2Page"
import EC2DetailPage from "@/pages/EC2DetailPage"
import ECSPage from "@/pages/ECSPage"
import ECSDetailPage from "@/pages/ECSDetailPage"
import AlarmsPage from "@/pages/AlarmsPage"
import SecurityPage from "@/pages/SecurityPage"
import SecurityDetailPage from "@/pages/SecurityDetailPage"
import S3Page from "@/pages/S3Page"
import S3DetailPage from "@/pages/S3DetailPage"
import CloudWatchPage from "@/pages/CloudWatchPage"
import LogDetailPage from "@/pages/LogDetailPage"

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light")

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"))

  return (
    <BrowserRouter>
      <AlertsProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Navbar theme={theme} toggleTheme={toggleTheme} />
          <ToastContainer />
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ec2" element={<EC2Page />} />
              <Route path="/ec2/:instanceId" element={<EC2DetailPage />} />
              <Route path="/ecs" element={<ECSPage />} />
              <Route path="/ecs/:clusterName" element={<ECSDetailPage />} />
              <Route path="/alarms" element={<AlarmsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/security/:groupId" element={<SecurityDetailPage />} />
              <Route path="/s3" element={<S3Page />} />
              <Route path="/s3/:bucketName" element={<S3DetailPage />} />
              <Route path="/logs" element={<CloudWatchPage />} />
              <Route path="/logs/:groupName" element={<LogDetailPage />} />
            </Routes>
          </main>
        </div>
      </AlertsProvider>
    </BrowserRouter>
  )
}