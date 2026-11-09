import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const StepsContext = createContext(null);
export function StepsProvider({ children }) {
  const [steps, setSteps] = useState([1, 2, 3, 4]);
  const [names, setNames] = useState({});
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const { data } = await api.get('/steps');
        if (live) { setSteps(data.steps); setNames(data.names || {}); }
      } catch { /* Keep the current step options until the connection recovers. */ }
    };
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { live = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);
  return <StepsContext.Provider value={{ steps, setSteps, names, setNames }}>{children}</StepsContext.Provider>;
}
export const useSteps = () => useContext(StepsContext);
