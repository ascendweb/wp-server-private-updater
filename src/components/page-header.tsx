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
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeaderCrumb = {
  label: string;
  href?: string;
};

interface HeaderState {
  title: string;
  crumbs: HeaderCrumb[];
  backHref?: string;
  actions: ReactNode;
}

interface HeaderContextValue {
  state: HeaderState;
  setHeader: (next: HeaderState) => void;
  clear: () => void;
}

const defaultState: HeaderState = { title: "", crumbs: [], actions: null };

const HeaderContext = createContext<HeaderContextValue>({
  state: defaultState,
  setHeader: () => {},
  clear: () => {},
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HeaderState>(defaultState);

  const setHeader = useCallback((next: HeaderState) => {
    setState(next);
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

  const crumbs = state.crumbs.length > 0 ? state.crumbs : [{ label: state.title }];

  return (
    <>
      {state.backHref ? (
        <Link
          href={state.backHref}
          aria-label="Go back"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-ml-2")}
        >
          <ChevronLeft />
        </Link>
      ) : null}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-base">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span className="text-muted-foreground" aria-hidden>
                  /
                </span>
              )}
              {last || !crumb.href ? (
                <h1 className="min-w-0 truncate font-semibold">{crumb.label}</h1>
              ) : (
                <Link href={crumb.href} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
      {state.actions && (
        <div className="ml-auto flex items-center gap-2">{state.actions}</div>
      )}
    </>
  );
}

/**
 * Call from client components to set the page title and optional
 * header actions. Title is a stable string; actions are read from a
 * ref so the effect only re-fires when the title or crumbs change.
 */
export function usePageHeader(
  title: string,
  actions?: ReactNode,
  nav?: { crumbs?: HeaderCrumb[]; backHref?: string },
) {
  const { setHeader, clear } = useContext(HeaderContext);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const crumbs = nav?.crumbs?.length ? nav.crumbs : [{ label: title }];
  const crumbsRef = useRef(crumbs);
  crumbsRef.current = crumbs;
  const crumbsKey = crumbs.map((c) => `${c.label}:${c.href ?? ""}`).join("|");
  const backHref =
    nav?.backHref ?? [...crumbs].slice(0, -1).reverse().find((c) => c.href)?.href;

  useEffect(() => {
    setHeader({
      title,
      crumbs: crumbsRef.current,
      backHref,
      actions: actionsRef.current,
    });
    return clear;
  }, [title, crumbsKey, backHref, setHeader, clear]);
}
