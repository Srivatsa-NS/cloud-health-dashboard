import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const serviceCards = [
    { title: "EC2 Instances", path: "/ec2", api: "/api/ec2", icon: "🖥️", countKey: "length", description: "Virtual machines" },
    { title: "ECS Clusters", path: "/ecs", api: "/api/ecs", icon: "🐳", countKey: "length", description: "Container clusters" },
    { title: "CloudWatch Alarms", path: "/alarms", api: "/api/alarms", icon: "🔔", countKey: "length", description: "Monitoring alarms" },
    { title: "Security Groups", path: "/security", api: "/api/security", icon: "🔒", countKey: "length", description: "Network security rules" },
    { title: "S3 Buckets", path: "/s3", api: "/api/s3", icon: "🪣", countKey: "length", description: "Object storage" },
]

function ServiceCard({ card }) {
    const [count, setCount] = useState(null)
    const [alert, setAlert] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        axios.get(card.api).then((res) => {
            setCount(res.data.length)
            // Flag alerts
            if (card.path === "/alarms") {
                setAlert(res.data.some((a) => a.state === "ALARM"))
            }
            if (card.path === "/security") {
                setAlert(res.data.some((sg) => sg.risky_rules.length > 0))
            }
            if (card.path === "/s3") {
                setAlert(res.data.some((b) => b.is_public))
            }
        }).catch(() => setCount("N/A"))
    }, [])

    return (
        <Card
            onClick={() => navigate(card.path)}
            className="bg-gray-900 border-gray-700 cursor-pointer hover:border-blue-500 transition-colors"
        >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white text-base">{card.title}</CardTitle>
                <span className="text-2xl">{card.icon}</span>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-3xl font-bold text-white">{count ?? "..."}</p>
                        <p className="text-gray-400 text-sm">{card.description}</p>
                    </div>
                    {alert && <Badge variant="destructive">Alert</Badge>}
                </div>
            </CardContent>
        </Card>
    )
}

export default function Dashboard() {
    const [lastRefreshed, setLastRefreshed] = useState(new Date())

    useEffect(() => {
        const interval = setInterval(() => {
            setLastRefreshed(new Date())
        }, 60000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-gray-400 mt-1">AWS Infrastructure Health Overview</p>
                </div>
                <p className="text-gray-500 text-sm">
                    Last refreshed: {lastRefreshed.toLocaleTimeString()}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceCards.map((card) => (
                    <ServiceCard key={card.path} card={card} />
                ))}
            </div>
        </div>
    )
}