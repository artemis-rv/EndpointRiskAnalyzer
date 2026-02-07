import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Endpoints from "./pages/Endpoints";
import Agent from "./pages/Agent";
import Jobs from "./pages/Jobs";


function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/endpoints" element={<Endpoints />} />
          <Route path="/agent" element={<Agent />} />
          <Route path="/jobs" element={<Jobs />} />


        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
