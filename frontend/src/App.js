import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Endpoints from "./pages/Endpoints";
import Agent from "./pages/Agent";
import Jobs from "./pages/Jobs";
import Posture from "./pages/Posture";

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <BrowserRouter>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/endpoints" element={<Endpoints />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/posture" element={<Posture />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
