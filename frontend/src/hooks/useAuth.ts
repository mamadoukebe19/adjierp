export function useAuth() {
  return {
    user: null,
    isAuthenticated: false,
    loading: false,
    login: () => {},
    loginLoading: false,
    loginError: null,
    logout: () => {},
    refetchProfile: () => {},
  };
}
