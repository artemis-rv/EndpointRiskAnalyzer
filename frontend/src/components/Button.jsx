export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    ...props
}) {
    const baseStyles = "font-medium rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

    const variants = {
        primary: "bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white shadow-md hover:shadow-lg dark:bg-primary-700 dark:hover:bg-primary-600",
        secondary: "bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100",
        danger: "bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-md hover:shadow-lg",
        ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading...</span>
                </div>
            ) : children}
        </button>
    );
}
