import { useState } from "react"

export default function FlipCard({ front, back }) {
    const [flipped, setFlipped] = useState(false)

    return (
        <div className="flip-card h-full" onClick={() => setFlipped((f) => !f)}>
            <div className={`flip-card-inner${flipped ? " flipped" : ""}`}>
                <div className="flip-card-front">{front}</div>
                <div className="flip-card-back">{back}</div>
            </div>
        </div>
    )
}
