import {BrowserRouter, Routes, Route} from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";
import {ProtectedRoute} from "./components/ProtectedRoute";
import {HomePage} from "./pages/HomePage";
import {SignupPage} from "./pages/SignupPage";
import {LoginPage} from "./pages/LoginPage";
import {ProfilePage} from "./pages/ProfilePage";
import {CardsPage} from "./pages/CardsPage";
import {CardDetailPage} from "./pages/CardDetailPage";
import {RecommendPage} from "./pages/RecommendPage";
import {EvaluatePage} from "./pages/EvaluatePage";
import {ForYouPage} from "./pages/ForYouPage";
import {OnboardingPage} from "./pages/OnboardingPage";
// WhichCardPage merged into RecommendPage — /which-card now redirects there

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/for-you"
            element={
              <ProtectedRoute>
                <ForYouPage />
              </ProtectedRoute>
            }
          />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
          <Route
            path="/recommend"
            element={
              <ProtectedRoute>
                <RecommendPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/evaluate"
            element={
              <ProtectedRoute>
                <EvaluatePage />
              </ProtectedRoute>
            }
          />
          {/* /which-card redirected to the unified assistant */}
          <Route path="/which-card" element={<ProtectedRoute><RecommendPage /></ProtectedRoute>} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
