import { BrowserRouter, Routes, Route } from "react-router-dom"
import Navbar from "@/components/Navbar"
import Dashboard from "@/pages/Dashboard"
import EC2Page from "@/pages/EC2Page"
import ECSPage from "@/pages/ECSPage"
import AlarmsPage from "@/pages/AlarmsPage"
import SecurityPage from "@/pages/SecurityPage"
import S3Page from "@/pages/S3Page"

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ec2" element={<EC2Page />} />
            <Route path="/ecs" element={<ECSPage />} />
            <Route path="/alarms" element={<AlarmsPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/s3" element={<S3Page />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}