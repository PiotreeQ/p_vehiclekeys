import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNuiEvent } from "../hooks/useNuiEvent";
import { fetchNui } from "../utils/fetchNui";
import { isEnvBrowser } from "../utils/misc";


const VisibilityCtx = createContext<VisibilityProviderValue | null>(null);


interface VisibilityProviderValue {
  setVisible: (visible: boolean) => void;
  visible: boolean;
}

export const VisibilityProvider: React.FC<{
  children: React.ReactNode;
  componentName: string;
}> = ({ children, componentName }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const setVisibleHandler = (visible: boolean) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (visible) {
      setVisible(true);
    } else {
      timeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        timeoutRef.current = null;
      }, 500);
    }
  };

  useNuiEvent<boolean>(`setVisible${componentName}`, setVisibleHandler);

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (visible && e.code === "Escape") {
        if (!isEnvBrowser()) fetchNui("hideFrame", { name: `setVisible${componentName}` });
        else setVisible(false);
      }
    };
    window.addEventListener("keydown", keyHandler);

    return () => window.removeEventListener("keydown", keyHandler);
  }, [visible, componentName]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <VisibilityCtx.Provider value={{ visible, setVisible }}>
      <div style={{ visibility: visible ? "visible" : "hidden" }}>
        {children}
      </div>
    </VisibilityCtx.Provider>
  );
};

export const useVisibility = () =>
  useContext<VisibilityProviderValue>(
    VisibilityCtx as React.Context<VisibilityProviderValue>
  );