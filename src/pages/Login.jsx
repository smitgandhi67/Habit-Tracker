import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSuccess = async (response) => {
    try {
      await login(response.credential);
      navigate('/today', { replace: true });
    } catch {
      alert('Sign-in failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-5xl">✅</div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Habit Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Track daily habits. Build streaks. Stay consistent.</p>
        </div>

        <div className="w-full border-t border-slate-100" />

        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Sign in to continue</p>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert('Sign-in failed. Please try again.')}
            shape="pill"
            size="large"
            width="280"
          />
        </div>

        <p className="text-xs text-slate-400 text-center">
          Your data is private and only visible to you.
        </p>
      </div>
    </div>
  );
}
