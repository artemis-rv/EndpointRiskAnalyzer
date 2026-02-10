export function LoadingSkeleton({ type = 'card', count = 1 }) {
    if (type === 'card') {
        return (
            <div className="space-y-4">
                {[...Array(count)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-6 animate-pulse">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft overflow-hidden animate-pulse">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {[...Array(count)].map((_, i) => (
                        <div key={i} className="p-4 flex gap-4">
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'stat') {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-soft p-4 animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            </div>
        );
    }

    return null;
}

export function TableSkeleton({ rows = 5 }) {
    return <LoadingSkeleton type="table" count={rows} />;
}

export function CardSkeleton({ count = 1 }) {
    return <LoadingSkeleton type="card" count={count} />;
}

export function StatSkeleton() {
    return <LoadingSkeleton type="stat" />;
}
