import TopNav from "./TopNav";

export default function MainLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <TopNav />
      <main className="transition-colors duration-300">
        {children}
      </main>
    </div>
  );
}
