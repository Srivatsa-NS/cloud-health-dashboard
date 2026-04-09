import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const API_BASE = ""

export default function App() {
  const [ecsClusters, setEcsClusters] = useState([])
  const [cpuData, setCpuData] = useState([])
  const [memoryData, setMemoryData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ecsRes, cpuRes, memRes] = await Promise.all([
          axios.get(`${API_BASE}/api/ecs`),
          axios.get(`${API_BASE}/api/cloudwatch/cpu`),
          axios.get(`${API_BASE}/api/cloudwatch/memory`)
        ])
        console.log(ecsRes)
        console.log(cpuRes)
        console.log(memRes)
        setEcsClusters(ecsRes.data)
        setCpuData(cpuRes.data)
        setMemoryData(memRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Cloud Infrastructure Health Dashboard</h1>

      {/* ECS Clusters */}
      <h2 className="text-xl font-semibold mb-4">ECS Clusters</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {ecsClusters.map((cluster) => (
          <Card key={cluster.cluster} className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">{cluster.cluster}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Running Tasks:</span>
                <Badge variant={cluster.running_tasks > 0 ? "default" : "secondary"}>
                  {cluster.running_tasks}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CPU Chart */}
      <h2 className="text-xl font-semibold mb-4">CPU Utilization (%)</h2>
      <Card className="bg-gray-900 border-gray-700 mb-8">
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
              <Line type="monotone" dataKey="cpu" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Memory Chart */}
      <h2 className="text-xl font-semibold mb-4">Memory Utilization (%)</h2>
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={memoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
              <Line type="monotone" dataKey="memory" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}