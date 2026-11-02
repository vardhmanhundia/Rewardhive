/**
 * Facebook Login Button Component
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import facebookService from '@/services/facebookService';

interface FacebookLoginButtonProps {
  onSuccess?: () => void;
  isLoading?: boolean;
}

export const FacebookLoginButton = ({ onSuccess, isLoading: externalLoading }: FacebookLoginButtonProps) => {
  const navigate = useNavigate();
  const { facebookLogin, error: authError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize Facebook SDK when component mounts
    facebookService.initializeFacebook();
  }, []);

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    try {
      const accessToken = await facebookService.getAccessToken();
      if (!accessToken) {
        throw new Error('Failed to get Facebook access token');
      }

      const userInfo = await facebookService.getFacebookUserInfo(accessToken);
      if (!userInfo) {
        throw new Error('Failed to get Facebook user info');
      }

      // Call the backend to authenticate
      await facebookLogin(
        accessToken,
        userInfo.email,
        userInfo.first_name,
        userInfo.last_name
      );

      if (onSuccess) {
        onSuccess();
      } else {
        // Default navigation after successful login
        navigate('/onboarding');
      }
    } catch (error) {
      console.error('Facebook login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleFacebookLogin}
      disabled={isLoading || externalLoading}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
    >
      {isLoading || externalLoading ? (
        'Connecting to Facebook...'
      ) : (
        <>
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Continue with Facebook
        </>
      )}
    </Button>
  );
};
