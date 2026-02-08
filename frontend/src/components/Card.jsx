export default function Card({
    children,
    title,
    subtitle,
    className = '',
    headerAction,
    ...props
}) {
    return (
        <div
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-soft hover:shadow-soft-lg transition-all duration-300 overflow-hidden ${className}`}
            {...props}
        >
            {(title || subtitle || headerAction) && (
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        {title && (
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
}

export function StatCard({ label, value, icon, trend, className = '' }) {
    return (
        <Card className={className}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {value}
                    </p>
                    {trend && (
                        <p className={`text-sm mt-2 ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                        {icon}
                    </div>
                )}
            </div>
        </Card>
    );
}
