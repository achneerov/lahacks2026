import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { SignupProvider } from './signup/SignupContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SignupBasics from './pages/signup/SignupBasics';
import SignupWorldId from './pages/signup/SignupWorldId';
import SignupProfile from './pages/signup/SignupProfile';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SignupProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signup" element={<SignupBasics />} />
            <Route path="/signup/world-id" element={<SignupWorldId />} />
            <Route path="/signup/profile" element={<SignupProfile />} />
          </Routes>
        </SignupProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
