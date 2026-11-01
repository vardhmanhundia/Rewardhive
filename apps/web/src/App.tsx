import {BrowserRouter, Routes, Route} from "react-router-dom";
import {AuthProvider} from "./context/AuthContext";
import {ProtectedRoute} from "./components/ProtectedRoute";
import {HomePage} from "./pages/HomePage";
import {SummaryPage} from "./pages/SummaryPage";
import {SignupPage} from "./pages/SignupPage";
import {LoginPage} from "./pages/LoginPage";
import {ProfilePage} from "./pages/ProfilePage";
import {OnboardingPage} from "./pages/OnboardingPage";
import {CardsPage} from "./pages/CardsPage";
import {CardDetailPage} from "./pages/CardDetailPage";
import {RecommendPage} from "./pages/RecommendPage";
import {EvaluatePage} from "./pages/EvaluatePage";
import {ForYouV2Page} from "./pages/ForYouV2Page";
import {OnboardingPage2} from "./pages/OnboardingPage2";
import {WhichCardPage} from "./pages/WhichCardPage";

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
                <SummaryPage />
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
          <Route
            path="/for-you-2"
            element={
              <ProtectedRoute>
                 <ForYouV2Page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/which-card"
            element={
              <ProtectedRoute>
                <WhichCardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding-2"
            element={
              <ProtectedRoute>
                <OnboardingPage2 />
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
