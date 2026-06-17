"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface HeaderState {
  title: string;
  actions: ReactNode;
}

interface HeaderContextValue {
  state: HeaderState;
  setHeader: (title: string, actions: ReactNode) => void;
  clear: () => void;
}

const defaultState: HeaderState = { title: "", actions: null };

const HeaderContext = createContext<HeaderContextValue>({
  state: defaultState,
  setHeader: () => {},
  clear: () => {},
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HeaderState>(defaultState);

  const setHeader = useCallback((title: string, actions: ReactNode) => {
    setState({ title, actions });
  }, []);

  const clear = useCallback(() => {
    setState(defaultState);
  }, []);

  return (
    <HeaderContext.Provider value={{ state, setHeader, clear }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function HeaderSlot() {
  const { state } = useContext(HeaderContext);
  if (!state.title) return null;

  return (
    <>
      <h1 className="text-base font-semibold">{state.title}</h1>
      {state.actions && (
        <div className="ml-auto flex items-center gap-2">{state.actions}</div>
      )}
    </>
  );
}

/**
 * Call from client components to set the page title and optional
 * header actions. Title is a stable string; actions are read from a
 * ref so the effect only re-fires when the title changes.
 */
export function usePageHeader(title: string, actions?: ReactNode) {
  const { setHeader, clear } = useContext(HeaderContext);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    setHeader(title, actionsRef.current);
    return clear;
  }, [title, setHeader, clear]);
}
