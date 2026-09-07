import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';

import * as authApi from '../api/auth';

const AuthContext =
  createContext(null);

export const AuthProvider = ({
  children
}) => {
  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const restoreSession =
      async () => {
        const token =
          localStorage.getItem(
            'taxipay_token'
          );

        if (!token) {
          setLoading(false);
          return;
        }

        try {
          const response =
            await authApi.getMe();

          setUser(
            response.data.user
          );
        } catch {
          localStorage.removeItem(
            'taxipay_token'
          );
        } finally {
          setLoading(false);
        }
      };

    restoreSession();
  }, []);

  const login = async (
    credentials
  ) => {
    const response =
      await authApi.login(
        credentials
      );

    const {
      token,
      user
    } = response.data;

    localStorage.setItem(
      'taxipay_token',
      token
    );

    setUser(user);

    return user;
  };

  const register = async (
    data
  ) => {
    const response =
      await authApi.register(data);

    const {
      token,
      user
    } = response.data;

    localStorage.setItem(
      'taxipay_token',
      token
    );

    setUser(user);

    return user;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(
        'taxipay_token'
      );

      setUser(null);
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.isAdmin;
  const updateUser = (updatedData) => setUser((prev) => ({ ...prev, ...updatedData }));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        isAdmin,
        updateUser,
        login,
        register,
        logout,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.'
    );
  }

  return context;
};