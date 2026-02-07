import TopNav from "./TopNav";

export default function MainLayout({ children }) {
  return (
    <div>
      <TopNav />
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}
