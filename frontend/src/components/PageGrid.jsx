export default function PageGrid({ children, className = "" }) {
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[minmax(10rem,auto)] ${className}`}>
            {children}
        </div>
    )
}
