import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import PageGrid from "@/components/PageGrid"

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
            className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
        >
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">{card.icon}</span>
                    {card.title}
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
                <CardAction>
                    {alert && <Badge variant="destructive">Alert</Badge>}
                </CardAction>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-bold">{count ?? "..."}</p>
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
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">AWS Infrastructure Health Overview</p>
                </div>
                <p className="text-muted-foreground text-sm">
                    Last refreshed: {lastRefreshed.toLocaleTimeString()}
                </p>
            </div>
            <PageGrid>
                {serviceCards.map((card) => (
                    <ServiceCard key={card.path} card={card} />
                ))}
            </PageGrid>
        </div>
    )
}