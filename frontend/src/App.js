import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Endpoints from "./pages/Endpoints";
import Agent from "./pages/Agent";
import Jobs from "./pages/Jobs";
import Posture from "./pages/Posture";
import Contact from "./pages/Contact";
import PageTransition from "./components/PageTransition";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/endpoints" element={<PageTransition><Endpoints /></PageTransition>} />
        <Route path="/agent" element={<PageTransition><Agent /></PageTransition>} />
        <Route path="/jobs" element={<PageTransition><Jobs /></PageTransition>} />
        <Route path="/posture" element={<PageTransition><Posture /></PageTransition>} />
        <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <BrowserRouter>
          <MainLayout>
            <AnimatedRoutes />
          </MainLayout>
        </BrowserRouter>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
