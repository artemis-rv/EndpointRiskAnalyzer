export default function Table({
    columns = [],
    data = [],
    className = '',
    stickyHeader = true,
    maxHeight = '600px',
}) {
    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-soft overflow-hidden ${className}`}>
            <div
                className={`overflow-auto scrollbar-thin ${stickyHeader ? 'max-h-[' + maxHeight + ']' : ''}`}
                style={stickyHeader ? { maxHeight } : {}}
            >
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className={`bg-slate-50 dark:bg-slate-900 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
                        <tr>
                            {columns.map((column, idx) => (
                                <th
                                    key={idx}
                                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                                >
                                    No data available
                                </td>
                            </tr>
                        ) : (
                            data.map((row, rowIdx) => (
                                <tr
                                    key={rowIdx}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150"
                                >
                                    {columns.map((column, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100"
                                        >
                                            {column.render ? column.render(row) : row[column.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
