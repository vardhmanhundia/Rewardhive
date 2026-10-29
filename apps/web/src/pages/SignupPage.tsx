/**
 * Signup page with shadcn/ui and Tailwind CSS
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const SignupPage = () => {
  const navigate = useNavigate();
  const { signup, error: authError, clearError } = useAuth();

  // Clear any auth error left over from another page (e.g. a failed login).
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.first_name) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await signup(
        formData.email,
        formData.first_name,
        formData.last_name,
        formData.password
      );
      navigate('/');
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-glow px-4 py-8">
      <Link to="/" className="mb-6 font-display text-xl font-bold tracking-tight">
        Card <span className="text-gradient">Agent</span>
      </Link>
      <Card className="w-full max-w-lg glass shadow-2xl shadow-black/40">
        <CardHeader className="space-y-2">
          <CardTitle className="font-display text-2xl font-bold text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Join us to start managing your cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-sm font-medium">
                  First Name
                </Label>
                <Input
                  id="first_name"
                  name="first_name"
                  type="text"
                  placeholder="John"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={errors.first_name ? 'border-red-500' : ''}
                  disabled={isLoading}
                />
                {errors.first_name && (
                  <p className="text-xs text-red-600">{errors.first_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-sm font-medium">
                  Last Name
                </Label>
                <Input
                  id="last_name"
                  name="last_name"
                  type="text"
                  placeholder="Doe"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={errors.last_name ? 'border-red-500' : ''}
                  disabled={isLoading}
                />
                {errors.last_name && (
                  <p className="text-xs text-red-600">{errors.last_name}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'border-red-500' : ''}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {authError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{authError}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
