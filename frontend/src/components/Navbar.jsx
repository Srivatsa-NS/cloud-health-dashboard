import { Link, useLocation } from "react-router-dom"

const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/ec2", label: "EC2" },
    { path: "/ecs", label: "ECS" },
    { path: "/alarms", label: "Alarms" },
    { path: "/security", label: "Security" },
    { path: "/s3", label: "S3" },
]

export default function Navbar() {
    const location = useLocation()

    return (
        <nav className="bg-gray-900 border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">CP</span>
                    </div>
                    <span className="text-white text-xl font-bold">CloudPulse</span>
                </div>
                <div className="flex items-center gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === item.path
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    )
}