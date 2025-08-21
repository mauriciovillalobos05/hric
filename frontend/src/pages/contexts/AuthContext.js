import { createContext, useContext } from "react";
export const AuthContext = createContext({ user: null, token: null });
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
