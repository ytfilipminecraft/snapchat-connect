import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CallProvider } from "@/context/CallContext";
import { CallOverlay } from "@/components/CallOverlay";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import TabsLayout from "@/layouts/TabsLayout";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Feed from "@/pages/Feed";
import Search from "@/pages/Search";
import CreatePost from "@/pages/CreatePost";
import ChatList from "@/pages/ChatList";
import ChatRoom from "@/pages/ChatRoom";
import Profile from "@/pages/Profile";
import EditProfile from "@/pages/EditProfile";
import Notifications from "@/pages/Notifications";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <CallProvider>
              <Routes>
                <Route path="/auth/login" element={<AuthRedirect><Login /></AuthRedirect>} />
                <Route path="/auth/register" element={<AuthRedirect><Register /></AuthRedirect>} />

                <Route path="/create" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
                <Route path="/chat/:id" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />
                <Route path="/u/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

                <Route element={<ProtectedRoute><TabsLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Feed />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/chat" element={<ChatList />} />
                  <Route path="/profile" element={<Profile self />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
              <CallOverlay />
            </CallProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
