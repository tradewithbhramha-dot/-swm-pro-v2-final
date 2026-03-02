import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import Module1DoorToDoor from "./pages/Module1DoorToDoor";
import Module2RoadSweeping from "./pages/Module2RoadSweeping";
import Module3Drainage from "./pages/Module3Drainage";
import Module4Depot from "./pages/Module4Depot";
import Settings from "./pages/Settings";
import OTPAuth from "./pages/OTPAuth";

function Router() {
  return (
    <Switch>
      <Route path={"/ "} component={Home} />
      <Route path={"/auth/otp"} component={OTPAuth} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/module1"} component={Module1DoorToDoor} />
      <Route path={"/module2"} component={Module2RoadSweeping} />
      <Route path={"/module3"} component={Module3Drainage} />
      <Route path={"/module4"} component={Module4Depot} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
